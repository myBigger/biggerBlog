---
author: 必哥
pubDatetime: 2026-04-15T00:00:00.000Z
title: 「必哥手记」| 第 2 期 · QtAuthNet 设计手记：一个轻量级 Qt HTTP 认证库的架构思路
slug: qtauthnet-design
featured: false
draft: false
tags:
  - Qt
  - 必哥手记
  - 开源
  - 架构设计
description: QtAuthNet 是一个只依赖 QtCore + QtNetwork 的轻量级 HTTP 认证封装库，支持 Bearer Token、HTTP Basic Auth、API Key 三种认证方式，CAS 2.0 单点登录开箱即用。本文完整记录其架构决策、CAS 协议实现细节，以及跨平台共享库的血泪踩坑史。
---

## 引子：从业务里长出来的轮子

写 Qt 十多年，我一直有个痛点没解决干净：**每一个新项目，只要涉及到 HTTP 认证，我都要从零写一遍 Bearer Token 管理、Basic Auth 注入、API Key 透传这些重复代码**。

更麻烦的是公司内部用的是 CAS（Central Authentication Service）单点登录，CAS 2.0 协议里那个 TGT（Ticket Granting Ticket）和 ST（Service Ticket）的交换流程，我用 QNetworkAccessManager 裸写了一遍又一遍，bug 修了一遍又一遍。

于是有了 QtAuthNet——一个只依赖 QtCore + QtNetwork 的轻量级 HTTP 认证封装库。目标很明确：**三行代码接入认证，CAS 单点登录开箱即用**。

GitHub 仓库：[github.com/myBigger/QtAuthNet](https://github.com/myBigger/QtAuthNet)

---

## 一、整体架构：两个类，一条职责边界

QtAuthNet 对外只暴露两个核心类，职责边界非常清晰：

```
QtAuthNet::Client      — 通用 HTTP 认证客户端
QtAuthNet::CasSession  — CAS 2.0 单点登录会话
```

`Client` 处理的是**与具体后端无关的认证机制**，比如 Bearer Token、HTTP Basic Auth、API Key 三种主流方式。`CasSession` 则专门处理 **CAS 协议的状态管理**，包括 TGT 生命周期、ST 自动换取、会话自动续期。

两者都继承自 `QObject`，都带有 `Q_OBJECT` 宏，支持 Qt 信号槽机制，但实际业务交互主要通过 **C++ `std::function` 回调**完成——这个设计决策下文会专门展开。

---

## 二、Client 类：认证机制的正交设计

`Client` 的构造只需要一行：

```cpp
QtAuthNet::Client client("https://api.example.com");
```

之后根据你的认证方式，配置链式叠加，互不干扰：

```cpp
// Bearer Token
client.setBearerToken("eyJhbGciOiJSUzI1NiJ9...");

// HTTP Basic Auth（与 Bearer 二选一）
client.setBasicAuth("admin", "s3cr3t");

// API Key（支持 Header 或 Query 参数）
client.setApiKey("your-api-key", "header");  // 写入 X-API-Key Header
client.setApiKey("your-api-key", "query");   // 追加到 URL Query String
```

**认证机制是正交叠加的**——`executeRequest` 里按优先级依次注入：

```cpp
if (apiKey in header)  → setRawHeader("X-API-Key", ...)
if (bearerToken)       → setRawHeader("Authorization", "Bearer ...")
if (basicAuth)         → setRawHeader("Authorization", "Basic ...")
for (customHeaders)   → setRawHeader(...)
```

正交设计的好处是：这几种认证方式可以共存，取决于服务器端接受哪一种（实际业务中通常只开一种）。更重要的是，新增认证方式不需要改 `executeRequest` 的结构，只需要在 `Private` 结构体里加一个字段。

### 发起请求：RESTful 方法全覆盖

```cpp
client.get("/users/me", [](const QByteArray& data) {
    qDebug() << data;
});

client.postJson("/orders", {{"item","book"},{"qty",1}}, [](const QByteArray& resp) {
    qDebug() << resp;
});

client.deleteResource("/orders/42", [](const QByteArray&) {});
```

`postJson` 是一个语法糖——内部自动把 `QVariant` 序列化为 JSON，不需要调用方手动写 `QJsonDocument::toJson`。这个方法在实际业务里使用频率极高。

### Token 自动刷新：那个烦人的 401

Bearer Token 过期是每个 RESTful API 都会遇到的问题。传统方案是在每个调用方手动判断 HTTP 状态码 401，然后调刷新接口，再重试。QtAuthNet 把这个逻辑下沉到库层：

```cpp
client.setTokenRefreshCallback([]() -> QString {
    // 调刷新接口，获取新 Token
    return newToken;
});
```

当 `QNetworkReply` 触发 `AuthenticationRequiredError` 时，`onReplyFinished` 自动调用这个 callback，用新 Token 替换旧 Token，并重新发起原请求。`isRefreshing` 布尔锁防止并发刷新。

---

## 三、CasSession 类：CAS 2.0 协议的实现细节

CAS（Central Authentication Service）是 Yale University 在 2001 年设计的单点登录协议，当前版本为 CAS 3.0，但 2.0 仍然是最广泛部署的版本，尤其在高校、企业内网场景。

### 协议流程：用一句话解释

> 用户登录 CAS → 获得 TGT（长期票据，可续期）→ 访问任意服务时，CAS 自动用 TGT 换取 ST（一次性服务票据）→ 带着 ST 访问目标服务 → 服务验证 ST 有效 → 完成

### QtAuthNet 里的 TGT/ST 流程

**登录阶段**（`login`）：

```
Client  POST  {username, password}  →  {casUrl}/v1/tickets/{username}
                                    ←  302 Redirect → {casUrl}/v1/tickets/TGT-xxx
```

CAS 服务器返回 302，Location Header 里的 TGT URL 就是我们需要的长期票据。QtAuthNet 解析这个重定向，或者直接解析纯文本响应（有些 CAS 实现不回 302）：

```cpp
QUrl redirectUrl = reply->attribute(QNetworkRequest::RedirectionTargetAttribute).toUrl();
if (redirectUrl.isValid()) tgtUrl = redirectUrl.toString();
else {
    QString resp = QString::fromUtf8(reply->readAll()).trimmed();
    if (resp.contains("TGT-")) tgtUrl = d->casUrl + "/v1/tickets/" + resp;
}
```

**服务访问阶段**（`get` / `post`）：

```
Client  POST  {service={targetUrl}}  →  {tgtUrl}
                                     ←  ST-xxx（纯文本，一次性票据）
Client  GET   {targetUrl}?ticket=ST-xxx
                                     ←  200 OK / 302 重定向到目标资源
```

用户代码只需：

```cpp
casSession.get("/protected/resource", [](const QByteArray& data) {
    // data 就是受保护资源的响应
});
```

内部自动完成两次网络请求：先换取 ST，再访问目标服务，对调用方完全透明。

### 自动续期：Timer 守护 TGT 生命周期

CAS TGT 通常有存活时间限制（默认 8 小时）。`CasSession` 在 `login` 成功后启动一个 `QTimer`，默认每 3600 秒自动续期：

```cpp
d->renewTimer->start(d->renewTimerIntervalSec * 1000);
```

如果续期失败（服务器不可达、TGT 已过期），`renewTimer` 停止，触发 `loginStatusChanged(false)` 信号，通知调用方需要重新登录。

---

## 四、关键技术决策：回调为什么用 `std::function`

Qt 的信号槽已经足够强大，为什么 QtAuthNet 选择在业务层用 `std::function` 回调而不是纯信号？

**答案：上下文绑定 + 类型安全**

Qt 信号需要类继承 + `Q_OBJECT` 宏，而回调是**临时性的、不需要跨组件传递的**业务逻辑：

```cpp
// 信号模式：需要一个持久的 QObject 槽
void MyWidget::onOrderCreated() { ... }
connect(orderClient, &Client::error, this, &MyWidget::onOrderCreated);

// 回调模式：业务逻辑内联，生命周期自动绑定
client.post("/orders", body, [](const QByteArray& resp) {
    // 此处 this 指向当前 Widget，resp 是本地变量
    // Lambda 结束后回调自动销毁，不需要额外的槽连接管理
});
```

更重要的是，**一次网络请求对应一次回调**，请求结束回调就销毁，没有信号断开遗漏导致的"旧回调还在触发"的问题。

### `std::function` 无法存进 `QList` 的解决方案

`std::function` 不支持 `==` 运算符，`QList::removeAll` 会编译失败。QtAuthNet 的解法是：**把回调绑定到对应的 `QNetworkReply` 对象上**，通过 Qt 的对象属性系统存储：

```cpp
// 发起请求时：存储回调
reply->setProperty("callback", QVariant::fromValue(callback));

// 请求完成时：取出回调
connect(reply, &QNetworkReply::finished, this, [this, reply]() {
    auto cb = reply->property("callback").value<std::function<void(const QByteArray&)>>();
    cb(reply->readAll());
    reply->deleteLater();
});
```

`QObject` 的动态属性系统支持存储 `QVariant`，而 `QVariant::fromValue<std::function<...>>()` 可以在需要时再反序列化。这个模式绕过了容器比较问题，同时天然地让回调和 `QNetworkReply` 的生命周期绑定——**请求销毁，回调跟着销毁**。

不过 `QVariant` 不能直接存储 `std::function`，需要先注册类型：

```cpp
// CasSession.cpp
static void registerMetaTypes() {
    qRegisterMetaType<std::function<void(const QByteArray&)>>();
    qRegisterMetaType<std::function<void(const QString&)>>();
    qRegisterMetaType<std::function<void(bool)>>();
}
Q_CONSTRUCTOR_FUNCTION(registerMetaTypes)
```

`Q_CONSTRUCTOR_FUNCTION` 是 Qt 提供的一个宏，在任何全局对象构造之前执行注册函数，确保类型在第一次使用前就已注册完毕。

---

## 五、跨平台共享库：qmake 的 `TEMPLATE = lib`

QtAuthNet 是一个**共享库**（.so / .dll），不是应用程序，这层配置在 `.pro` 里只有一行，但踩过的坑值得单独写一节：

```pro
TEMPLATE = lib          # 告诉 qmake 生成库，不是可执行文件
QT = core network        # 只依赖 Qt 核心模块，无 GUI 依赖
CONFIG += c++17
DEFINES += QTAUTHNET_LIBRARY
```

**为什么不用 `CONFIG += dll`？** `dll` 是 Windows 特有的 CONFIG 标志，在 Linux 上 qmake 会忽略它，导致生成的是可执行文件链接器配置（需要 `main()`）。`TEMPLATE = lib` 是平台无关的指令：Linux 生成 `.so`，Windows 生成 `.dll`，macOS 生成 `.dylib`，调用方不需要任何平台判断。

**`DEFINES += QTAUTHNET_LIBRARY` 是干什么的？** 这个宏控制导出符号的行为：

```cpp
// qtauthnet_global.h
#if defined(QTAUTHNET_LIBRARY)
#  define QTAUTHNET_EXPORT Q_DECL_EXPORT  // 导出：构建库本身时
#else
#  define QTAUTHNET_EXPORT Q_DECL_IMPORT  // 导入：库的使用者
#endif
```

不加这行，moc 生成的 `.cpp` 文件里的 `staticMetaObject` 会被编译器标记为 `dllimport`，而我们又在 moc 文件里定义了它——**MSVC 报错：`definition of dllimport static data member not allowed`**。GCC/Clang 对这个错误更宽容，但 MSVC 是严格模式，必须在 `.pro` 里显式定义。

---

## 六、CI/CD：GitHub Actions 双平台构建的血泪史

QtAuthNet 的 GitHub Actions 流水线同时在 Windows（msvc2022\_64）和 Linux（gcc\_64）两个平台上构建，每一次 push 自动触发，artifact 直接上传到 GitHub。

这一路踩了几个坑，记录在此供后来者参考：

### Linux：`undefined reference to main`

原因：`.pro` 写了 `CONFIG += dll`，qmake 在 Linux 上把它当可执行文件处理。修复：改为 `TEMPLATE = lib`。

### Windows：`Cannot run compiler 'cl'`

`setup-msbuild` action 只设置了 `VSINSTALLDIR` 环境变量，但不会自动让后续的 cmd/powershell 步骤里出现 `cl.exe`。必须在 Build 步骤里显式调用 `vcvarsall.bat`，并且所有命令串在一个 `cmd.exe` 会话里执行：

```yaml
- name: Build
  shell: cmd
  run: |
    call "C:\Program Files\Microsoft Visual Studio\2022\Enterprise\VC\Auxiliary\Build\vcvarsall.bat" amd64
    set PATH=%QT_ROOT_DIR%\bin;%PATH%
    mkdir release
    qmake QtAuthNet.pro -spec win32-msvc
    nmake
```

### Windows：`staticMetaObject dllimport`

上文已解释，加 `DEFINES += QTAUTHNET_LIBRARY` 解决。

---

## 七、写在最后

开源一个库最难的从来不是写代码，而是**想清楚这个库的生命周期**：它解决什么问题？不解决什么问题？API 暴露多少才够用但不过度设计？

QtAuthNet 的设计哲学是：**最小化依赖，最小化 API surface，只做认证层，不碰业务层**。HTTP 请求怎么发、JSON 怎么解析、UI 怎么渲染，这些都由调用方自己决定。QtAuthNet 只负责一件事——让认证这件事，变得可靠且无感。

---

*必哥手记 · 第 2 期 · 2026-04-15*

*首发于 [biggerblog.vercel.app](https://biggerblog.vercel.app) · QtAuthNet 源码：[GitHub](https://github.com/myBigger/QtAuthNet)*
