---
author: 必哥
pubDatetime: 2026-04-18T00:00:00Z
title: 从三个真实项目看 Qt 网络库的设计误区
slug: qtauthnet-design-mistakes
featured: false
draft: false
tags:
  - Qt
  - C++
  - 必哥手记
  - 开源
description: 通过对 CorpHub、AuditScreen、GuardDesk 三个真实 Qt 桌面应用的适配性分析，揭示了一个开源 Qt HTTP 库设计上的根本偏差——以及为什么"简化 HTTP 调用"不是真正的痛点。
---

## 引子

我写了一个 Qt 网络库，叫 QtAuthNet。

目标很清晰：**让 Qt 桌面应用的 HTTP 请求从繁琐变简洁**。Bearer Token、CAS 单点登录、lambda 回调链——听起来很美好。

然后我拿它去适配我自己写的三个真实项目。

结果：**三个项目，一个都接不进去**。

这篇文章不是耻辱碑，是复盘报告。

---

## 一、我以为的痛点 vs 真实的痛点

写 QtAuthNet 的时候，我假设的痛点是：

> 每次写 HTTP 请求都要抄六行样板代码，烦死了。

所以我把力气花在"减少样板代码"上：做一个 Client 类，把 Bearer Token、Basic Auth、API Key 都封装进去。再做一个 CasSession，把 CAS 协议管理起来。

听起来很合理。

然后我拿这三个项目来验证：

| 项目 | 技术栈 | 认证方式 | 代码规模 |
|---|---|---|---|
| CorpHub | Qt6 / qmake | 自定义 CAS + Bearer Token | ~1400 行 HTTP 代码 |
| AuditScreen | Qt6 / CMake | BaseApi（自研）+ 三套 API | ~600 行网络层代码 |
| GuardDesk | Qt5 / CMake | 三套 HttpClient（A/B/C 三套子系统） | ~500 行网络层代码 |

三个项目，网络层代码一个比一个复杂。

三个项目，**没有一个愿意换成 QtAuthNet**。

---

## 二、第一个项目：CorpHub

CorpHub 的 `CasAuth` 处理的是这样的流程：

1. `GET /cas/login?service=...` → 获取 HttpOnly Cookie
2. POST 表单（用户名 + **RSA 加密密码** + 二十多个额外字段）→ 获取 CAS Ticket
3. 用 Ticket 换取子系统 A Token
4. 用 Ticket 换取子系统 B Token
5. 登出时：子系统 A 登出 → 子系统 B 登出 → CAS 登出 → 重新 getSession

而 QtAuthNet 的 `CasSession` 假设的是标准 CAS 2.0：TGT → ST，协议固定，字段固定。

**两者的协议根本不同。** 不是"略有差异"，是整个交互流程都对不上。

我花了两个小时试图对齐字段，发现 CasAuth 里有一段注释：

> CAS 登录用的是 `loginType=2`，`execution=e1s1`，`_eventId=submit`，`geolocation=`……
> 这些字段不是可选的，是服务端要求的。

这些字段 QtAuthNet 根本没考虑。

---

## 三、第二个项目：AuditScreen

AuditScreen 的 BaseApi 已经做得相当完善了：

- 每个请求带**独立超时 Timer**（30 秒，默认可配置）
- **指数退避重试**（1s → 2s → 4s）
- 错误分类枚举（`Err::NetTimeout` / `Err::HttpUnauthorized` / `Err::BizParseFailed`）
- 统一的 `HttpResponse` 封装

我看完 BaseApi 源码之后，沉默了很久。

**BaseApi 比 QtAuthNet::Client 做得更好。**

具体好在哪：

```cpp
// AuditScreen BaseApi 的重试逻辑
bool shouldRetry = hasError && ErrorHandler::isRetryable(errCode)
                   && attempt < m_maxRetries;
if (shouldRetry) {
    scheduleRetry(verb, path, body, cb, ctype, attempt + 1);
    return;
}
```

指数退避在 `scheduleRetry` 里实现：

```cpp
int delayMs = 1000 * (1 << (attempt - 1)); // 1s → 2s → 4s
QTimer::singleShot(delayMs, this, [=]() {
    sendRequest(verb, path, body, callback, contentType);
});
```

而 QtAuthNet::Client 的 error 处理是这样的：

```cpp
} else if (reply->error() == QNetworkReply::AuthenticationRequiredError) {
    if (d->refreshCallback && !d->isRefreshing) {
        d->isRefreshing = true;
        d->bearerToken = d->refreshCallback();
        d->isRefreshing = false;
    }
    emit error(...);
    callback(QByteArray());  // ← 直接结束了，原请求没有重试
}
```

**收到 401 之后调用了 refreshCallback，但没有重试原请求。** 用户体验是：token 刷新了，但当前请求还是报错。

这不是"功能少一点"，这是功能有 bug。

---

## 四、第三个项目：GuardDesk

GuardDesk 的 HttpClient 最特别的是：**按子系统隔离单例**。

```cpp
enum class HttpSystem {
    SysA,  // 综合业务系统 → ASP.NET SessionId
    SysB,  // 考核系统 → Bearer Token
    SysC   // 台账系统 → ASP.NET SessionId
};

HttpClient* HttpClient::instance(HttpSystem sys) {
    int idx = static_cast<int>(sys);
    if (!s_instances[idx]) {
        s_instances[idx] = new HttpClient(sys);
    }
    return s_instances[idx];
}
```

三个子系统，三套 NAM，三套认证逻辑。

QtAuthNet::Client 是**单一实例**，所有请求共享同一个 NAM。

GuardDesk 的开发者为什么要这样设计？

因为 SysA 和 SysC 用的是 ASP.NET 的 SessionId Cookie，SysB 用的是 Bearer Token。**认证方式不同，Cookie 不能混用**。如果共享 NAM，不同子系统的 Cookie 会互相污染，导致请求带着错误的认证信息。

这个设计 QtAuthNet 完全没想到。

---

## 五、真正的根因是什么

三个项目适配失败，表面上原因各不相同：

- CorpHub：CAS 协议不对
- AuditScreen：BaseApi 比 Client 更好，替换等于降级
- GuardDesk：多子系统隔离 NAM，Client 架构不支持

但往深一层看，**三个项目都在重复做同样的事**：

```
每个项目都有一套自己的 HTTP 工具层
├── 超时处理（有的有，有的没有）
├── 重试逻辑（有的有，有的没有）
├── 错误分类（有的有，有的没有）
└── 认证管理（Bearer / Cookie / RSA，各不相同）
```

**真正的痛点不是"HTTP 请求代码太长"，而是"每个 Qt 项目都在重复造同一个 HTTP 工具层"。**

QtAuthNet 把力气花在了"简化认证协议抽象"上，但三个项目真正需要的，是更底层的东西：

| 真正需要的 | CorpHub | AuditScreen | GuardDesk |
|---|---|---|---|
| 超时管理 | ❌（自己没做） | ✅ BaseApi 有 | ❌ |
| 指数退避重试 | ❌ | ✅ BaseApi 有 | ❌ |
| 错误分类体系 | ❌ | ✅ ErrorHandler 有 | ❌ |
| 请求取消（单请求粒度） | ❌ | ❌ | ❌ |

这些东西，**每个项目都在重复发明一次**。

---

## 六、我踩的坑的本质

回过头看，我犯了一个典型的开源作者的错误：

> **在真实用户反馈之前，先假设了需求。**

我写 QtAuthNet 的时候，觉得"HTTP 样板代码太烦"是痛点。所以做了一个 Client。

但真实用户（我自己写的三个项目）的痛点根本不是这个。

**真实痛点是：Qt 生态里，没有一个库把"超时 + 重试 + 错误分类"这三件事做好。**

每个 Qt 开发者都在自己项目里重新实现一遍。这不是懒，是没得选。

QtAuthNet 本来有机会做这个底层工具。但我把精力花在了"认证协议抽象"上——偏偏实际业务中几乎没有标准 CAS 协议，抽象出来的价值接近零。

---

## 七、改进方案

基于这次复盘，QtAuthNet 需要重构为两个独立的层次：

### 第一层：QtNet —— 底层网络工具

这是真正有价值的部分，也是所有项目都在重复造的轮子：

```cpp
struct NetOptions {
    int timeoutMs = 15000;        // 超时，默认 15s
    int maxRetries = 3;           // 最大重试次数
    int retryDelayMs = 500;       // 首次重试延迟
    bool retryOnTimeout = true;   // 超时是否重试
    bool retryOn5xx = true;       // 5xx 是否重试
};

class NetClient : public QObject {
    Q_OBJECT
public:
    void get(const QString& url, const NetOptions& opts,
             const std::function<void(const NetResponse&)>& cb);
    void post(const QString& url, const QByteArray& body, const NetOptions& opts,
              const std::function<void(const NetResponse&)>& cb);

    void cancel(int requestId);    // 单请求粒度取消
    void cancelAll();
};
```

指数退避重试策略：

```
第 0 次失败 → 等待 500ms → 重试（第 1 次）
第 1 次失败 → 等待 1000ms → 重试（第 2 次）
第 2 次失败 → 等待 2000ms → 重试（第 3 次）
第 3 次失败 → 报告最终错误
```

### 第二层：QtAuth —— 认证层，按场景不按协议

不做"标准协议抽象"，做"场景化认证模式"：

```cpp
// 场景一：Bearer Token（最常见的现代 API）
class BearerAuth {
    void setToken(const QString& token);
    void setRefreshCallback(std::function<QString()> fn);  // 401 后自动刷新并重试
    NetClient* client();  // 自动注入 Bearer Token
};

// 场景二：RSA + Cookie（内部系统最常见）
// CorpHub 的 CAS、各类自研 B/S 系统属于这个模式
class RsaCookieAuth {
    void setPublicKey(const QString& key);
    void login(const QString& url, const QString& user, const QString& pass,
               std::function<void(bool, QString)> cb);
    NetClient* client();
};

// 场景三：ASP.NET SessionId（老系统）
class SessionCookieAuth {
    void login(const QString& url, const QString& postData,
               std::function<void(bool, QString)> cb);
    NetClient* client();
};
```

---

## 八、延伸思考

### 你解决的是你自己的问题，不是用户的问题

这次复盘让我对"做开源项目"这件事有了新的理解。

**开源项目的价值，不在于解决了你想解决的问题，而在于解决了真实用户真正存在的问题。**

QtAuthNet 的 README 写得很漂亮："让 Qt HTTP 请求从繁琐变简洁"。这句话在技术上是对的，但在实际场景里，没有人在乎"代码是不是繁琐"。

大家在乎的是：
- 网络抖动后会不会自动重试？
- 请求超时了用户等多久？
- 出错了有没有友好的错误提示，而不是一串错误码？

这些问题 QtAuthNet 一个都没解决。

**写库的人最容易犯的错，是把自己的需求当成用户的需求。**

我需要从"我要做一个简洁的 HTTP 库"，变成"Qt 桌面开发者需要什么样的网络基础设施"。

这两件事，差别巨大。

### 发明者困境：做得越多，错得越远

有一个有意思的现象：QtAuthNet 功能越多，适配三个项目越难。

如果 QtAuthNet 只有一个裸的 `QNetworkAccessManager` 封装，三个项目说不定还能凑合用。加上 CasSession 之后，反而成了障碍——因为 CasSession 强制假定了一个标准协议，而这个协议跟三个项目里任何一个都对不上。

这叫**过度设计对核心场景的反噬**。

更讽刺的是：标准 CAS 协议在现实里几乎不存在。我调研了三个项目，零个用标准 CAS。但我花了整个 CasSession 类的代码量去处理这个不存在的东西。

正确的优先级应该是：

```
实际需求排序（按出现频率）：
1. 超时 + 重试（每个项目都有，每个项目都自己写）
2. 错误分类（项目越大越需要）
3. 认证注入（Bearer Token 最常见）
4. 协议抽象（几乎没有标准协议，抽象价值极低）
```

我的代码量分配刚好反了过来。

### 为什么 Qt 生态里没人做这个

你可能会问：超时 + 重试 + 错误分类，这种基础功能，难道 Qt 生态里真没人做？

还真没有。

Qt 官方的 `QNetworkAccessManager` 是裸封装，没有任何重试逻辑。Qt Coap、Qt Http2 都是更上层的协议实现，不是网络工具层。Qt Asio 在同步模式下的体验一言难尽。Qt 网络库生态里，**超时和重试是被默认忽视的功能**。

这不是 Qt 的问题，是整个 C++ 生态的问题。C++ 开发者习惯了"自己造"，但每个项目都造一遍，本质上是集体在浪费。

这也解释了为什么 Python 有 `requests`，JavaScript 有 `axios`，而 C++ Qt 圈子里没人出来做这件事。

### 抽象的层次感：不该在第一层解决的问题

另一个值得反思的点：**认证协议抽象应该在哪一层做？**

QtAuthNet 试图在最底层（HTTP 客户端）做认证抽象。这导致一旦协议不是标准 CAS，整个抽象就废了。

更好的思路是：**认证是业务层的事，网络层只负责可靠传输**。

```
正确的层次：
┌─────────────────────────┐
│  业务层（你的 App 代码）  │  ← 知道用什么认证，知道怎么处理 401
├─────────────────────────┤
│  QtAuth（认证场景封装）   │  ← Bearer / RSA+Cookie / Session，按场景不按协议
├─────────────────────────┤
│  QtNet（底层工具）        │  ← 超时 + 重试 + 错误分类，与认证无关
├─────────────────────────┤
│  QNetworkAccessManager  │  ← Qt 底层，不管业务
└─────────────────────────┘

QtAuthNet 的错误层次：
┌─────────────────────────┐
│  业务层                  │
├─────────────────────────┤
│  QtAuthNet::Client      │  ← 把认证和网络混在一起
├─────────────────────────┤
│  QtAuthNet::CasSession  │  ← 抽象了一个不存在的标准
└─────────────────────────┘
```

层次混乱的代价是：修改认证逻辑会影响网络层，修改网络层会破坏认证逻辑。两边都在改同一个类，改到最后谁都不敢动。

### 真实反馈的成本

这次复盘还有一个感受：**我本来可以更早知道这些。**

三个项目就在我的硬盘里。只要我一开始不是"假设需求"，而是"先去问问三个项目"，就能提前知道：

- "我不用标准 CAS"（CorpHub）
- "我的重试逻辑比你的完善"（AuditScreen）
- "我需要多套 NAM 隔离"（GuardDesk）

**做开源最大的浪费，不是代码写错了，而是代码写完了才发现没人需要。**

解决这个问题的方法不是"更努力地思考"，而是"更早地去问"。一个小时的真实访谈，可以省下三天的无效实现。

这不是事后诸葛亮。这是产品思维的基本功，只是写代码的人很少练习。

### 什么是真正值得抽象的东西

回过头来，什么是值得抽象的？

**值得抽象**：每个项目都在重复做，但各自做得不一样，功能本质相同的东西。

- 超时处理：都是"超过 N 毫秒就放弃"，实现方式不同
- 重试策略：都是"失败了等一下再试"，等待策略不同
- 错误分类：都是"把错误归个类"，分类标准不同

**不值得抽象**：每个项目做法不同，且背后没有共同的底层逻辑。

- CAS 协议：三个项目用了三种"类 CAS"流程，没有共同点
- 认证字段：CorpHub 有二十多个自定义字段，别的项目可能完全不同
- Cookie 管理：不同子系统的 Cookie 根本不能共享，但这是架构问题不是工具问题

区分这两类的标准是：**底层逻辑是否一致，实现细节是否不同**。一致的东西才值得抽象，不一致的东西只做工具函数就够了。

---

## 九、改进方案

基于这次复盘，QtAuthNet 需要从**一个混合库**拆分为**两个独立层次**：

```
QtNet（第一层）  — 底层网络工具，不含认证，专注可靠传输
QtAuth（第二层） — 认证场景封装，按使用场景不按协议标准
```

两层独立意味着：使用者可以只引入 QtNet，不引入 QtAuth；也可以在 QtNet 基础上叠加 QtAuth；还可以用自己的认证逻辑接入 QtNet。依赖关系是单向的，没有循环。

### 第一层：QtNet 底层网络工具

这是真正有价值的部分，也是所有 Qt 项目都在重复发明的轮子。

**NetResponse：统一响应封装**

```cpp
struct NetResponse {
    int requestId;                    // 请求唯一 ID，用于 cancel
    int httpStatusCode;                // HTTP 状态码，0 表示网络错误
    QByteArray body;                  // 响应体
    QString errorString;              // 人类可读的错误描述
    ErrorCategory category;           // 错误分类（见下文）
    int attemptNumber;                // 这是第几次尝试（用于重试场景）
    QNetworkReply* rawReply;          // 原始 reply，可选，用于高级用法
};
```

**错误分类：为什么这很重要**

错误分类是整个改进方案里被低估得最严重的设计决策。

AuditScreen 的 BaseApi 有完整的错误分类枚举，每个错误都有明确来源。QtAuthNet 没有，导致调用方收到错误后只能做字符串匹配或者直接弹"网络错误"。

正确的错误分类：

```cpp
enum class ErrorCategory {
    // 网络层错误
    NetTimeout,         // 连接超时或读取超时
    NetConnectionRefused, // 连接被拒绝（服务器没开）
    NetHostNotFound,    // DNS 解析失败
    NetSslError,        // SSL 证书错误
    NetOther,           // 其他网络错误

    // HTTP 层错误（响应已收到，但状态码不是 2xx）
    HttpBadRequest,     // 400
    HttpUnauthorized,   // 401（未认证）
    HttpForbidden,      // 403（权限不足）
    HttpNotFound,       // 404
    Http5xxServerError, // 500/502/503/504

    // 业务层错误
    BizParseFailed,     // JSON 解析失败
    BizLogicError,      // 业务逻辑错误（通常是 200 但带了错误码字段）

    // 其他
    RequestCancelled,  // 主动取消
    Unknown
};
```

为什么要分三层？因为**不同错误类别对应不同的用户提示和处理策略**：

- 网络超时 → "网络连接不稳定，请检查网络后重试"
- 401 → 自动刷新 Token 并重试（用户无感知）
- 500 → 可以重试，且重试有意义（服务器临时故障）
- 400 → 不重试，重试也是 400（请求本身有问题）
- JSON 解析失败 → 不重试，可能是接口变更（需要告警）

**没有分类，就只能对所有错误用同一个处理逻辑——要么过度重试，要么漏掉该重试的。**

**NetOptions：超参配置**

```cpp
struct NetOptions {
    int timeoutMs = 15000;          // 读写超时，默认 15 秒
    int maxRetries = 3;             // 最大重试次数
    int retryBaseDelayMs = 500;     // 指数退避基数
    bool retryOnTimeout = true;     // 超时是否重试
    bool retryOn5xx = true;         // 5xx 是否重试
    bool retryOnConnectionError = false; // 连接错误（ECONNREFUSED）一般不重试
    QMap<int, bool> retryableStatusCodes; // 自定义哪些状态码可重试
};
```

为什么有些错误默认不重试？连接被拒绝（`ECONNREFUSED`）通常是服务器进程挂了，重试一万次也没用。超时则不同，可能是网络抖动，典型场景下重试 2-3 次有显著效果。

**NetClient：API 设计**

```cpp
class NetClient : public QObject {
    Q_OBJECT

public:
    // 构造：传入基础 URL，路径在请求时拼接
    explicit NetClient(const QUrl& baseUrl, QObject* parent = nullptr);

    // GET / POST / DELETE，签名统一
    int get(const QString& path, const NetOptions& opts,
            std::function<void(const NetResponse&)> cb);
    int post(const QString& path, const QByteArray& body,
             const QString& contentType, const NetOptions& opts,
             std::function<void(const NetResponse&)> cb);
    int postJson(const QString& path, const QVariant& jsonBody,
                 const NetOptions& opts,
                 std::function<void(const NetResponse&)> cb);
    int deleteResource(const QString& path, const NetOptions& opts,
                       std::function<void(const NetResponse&)> cb);

    // 取消
    void cancel(int requestId);      // 取消单个请求
    void cancelAll();                // 取消所有请求

    // 请求 ID 分配
    int nextRequestId();

signals:
    void requestFinished(int requestId, const NetResponse& resp);

private:
    void sendWithRetry(const QString& verb, const QString& path,
                       const QByteArray& body, const QString& contentType,
                       const NetOptions& opts,
                       std::function<void(const NetResponse&)> cb,
                       int attempt);

    ErrorCategory categorizeError(QNetworkReply::NetworkError err,
                                  int httpStatus);
    QString errorCategoryToString(ErrorCategory cat);
};
```

为什么返回 `int`（请求 ID）？因为取消操作需要引用这个请求。调用方拿到 ID 之后可以随时 `cancel(id)`，不需要持有回调闭包。

**指数退避：实现细节**

```cpp
void NetClient::sendWithRetry(
        const QString& verb, const QString& path,
        const QByteArray& body, const QString& contentType,
        const NetOptions& opts,
        std::function<void(const NetResponse&)> cb,
        int attempt)
{
    QNetworkRequest req = buildRequest(path);
    req.setRawHeader("Content-Type", contentType.toUtf8());

    QNetworkReply* reply = nam()->sendRequest(req, verb, body);

    // 绑定请求 ID 和回调
    reply->setProperty("requestId", m_nextId++);
    reply->setProperty("callback", QVariant::fromValue(cb));
    reply->setProperty("opts", QVariant::fromValue(opts));
    reply->setProperty("verb", verb);
    reply->setProperty("path", path);

    connect(reply, &QNetworkReply::finished, this, [=]() {
        handleReply(reply, opts, cb, attempt);
    });

    // 超时单独处理，不用 QNetworkRequest::setTransferTimeout
    // （Qt 5.x 的 TransferTimeout 是 Qt6 才有的）
    QTimer* timeoutTimer = new QTimer(reply);
    timeoutTimer->setSingleShot(true);
    timeoutTimer->setProperty("reply", QVariant::fromValue(reply));
    timeoutTimer->setProperty("opts", QVariant::fromValue(opts));
    timeoutTimer->setProperty("verb", verb);
    timeoutTimer->setProperty("path", path);
    timeoutTimer->setProperty("body", body);
    timeoutTimer->setProperty("contentType", contentType);
    timeoutTimer->setProperty("cb", QVariant::fromValue(cb));
    timeoutTimer->setProperty("attempt", attempt);
    timeoutTimer->connect(timeoutTimer, &QTimer::timeout, this, [=]() {
        handleTimeout(reply, opts, verb, path, body, contentType, cb, attempt);
    });
    timeoutTimer->start(opts.timeoutMs);
}

void NetClient::handleReply(QNetworkReply* reply,
                            const NetOptions& opts,
                            std::function<void(const NetResponse&)> cb,
                            int attempt)
{
    int httpStatus = reply->attribute(QNetworkRequest::HttpStatusCodeAttribute).toInt();
    auto category = categorizeError(reply->error(), httpStatus);

    // 是否应该重试？
    bool shouldRetry = false;
    if (attempt < opts.maxRetries) {
        if (opts.retryOnTimeout && category == ErrorCategory::NetTimeout) {
            shouldRetry = true;
        }
        if (opts.retryOn5xx && category == ErrorCategory::Http5xxServerError) {
            shouldRetry = true;
        }
    }

    if (shouldRetry) {
        int delayMs = opts.retryBaseDelayMs * (1 << (attempt - 1)); // 500 → 1000 → 2000
        QTimer::singleShot(delayMs, this, [=]() {
            sendWithRetry(verb, path, body, contentType, opts, cb, attempt + 1);
        });
        return;
    }

    // 不重试，返回最终结果
    NetResponse resp{
        .requestId = reply->property("requestId").toInt(),
        .httpStatusCode = httpStatus,
        .body = reply->readAll(),
        .errorString = reply->errorString(),
        .category = category,
        .attemptNumber = attempt,
        .rawReply = reply
    };
    cb(resp);
    reply->deleteLater();
}
```

**多 NAM 架构：如何支持 GuardDesk 的场景**

GuardDesk 的教训告诉我们：**某些场景下，Cookie 隔离比代码简洁更重要**。

QtNet 的解决方式：每个 `NetClient` 实例持有一个独立的 `QNetworkAccessManager`，默认共享全局实例，但允许调用方创建独立实例：

```cpp
class NetClient : public QObject {
    // ...
private:
    QNetworkAccessManager* nam();   // 返回当前 NAM

    void useSharedNam();            // 使用全局共享 NAM（默认）
    void useIsolatedNam();          // 为这个 Client 创建独立 NAM
    void useNam(QNetworkAccessManager* externalNam); // 注入外部 NAM

    QNetworkAccessManager* m_nam = nullptr;
    bool m_ownsNam = false;         // 是否拥有这个 NAM
    static QNetworkAccessManager* s_sharedNam; // 全局共享 NAM
};
```

使用方式：

```cpp
// GuardDesk SysA：独立的 ASP.NET SessionId Cookie 管理
auto* clientA = new NetClient(QUrl("https://sysa.internal.com"));
clientA->useIsolatedNam();  // SysA 的 Cookie 不会污染其他系统

// GuardDesk SysB：Bearer Token，无状态，不需要隔离 NAM
auto* clientB = new NetClient(QUrl("https://sysb.internal.com"));
// 默认使用共享 NAM，更省资源
```

注意：独立 NAM 会有轻微的连接池效率损失（每个 NAM 各自维护连接池）。所以默认用共享 NAM，只在需要 Cookie 隔离时才创建独立 NAM。

### 第二层：QtAuth 认证场景封装

不做"标准协议抽象"，做"场景化认证模式"。

**场景划分的原则**：按**使用频率**和**技术特征**划分，不按协议标准划分。

```
场景一：BearerAuth — 现代 RESTful API，最常见
  特征：Token 在 Header，无状态，每次请求独立认证

场景二：RsaCookieAuth — 内部 B/S 系统登录，最麻烦
  特征：登录时用 RSA 加密密码，获取 Cookie，后续请求带 Cookie

场景三：SessionCookieAuth — 老系统 ASP.NET SessionId
  特征：登录获取 SessionId Cookie，后续请求带同一个 Cookie

场景四：BasicAuth — 内网简单接口，偶尔用
  特征：用户名密码 Base64 编码在 Header，每请求发送一次
```

为什么这样划分？因为这三个场景背后有不同的技术挑战：

- BearerAuth 的挑战是 Token 刷新和并发重试锁
- RsaCookieAuth 的挑战是 RSA 加密流程和 Cookie 管理
- SessionCookieAuth 的挑战是 Cookie 生命周期和续期

**BearerAuth：Token 刷新 + 重试**

这是最常见也最容易出 bug 的场景：

```cpp
class BearerAuth : public QObject {
    Q_OBJECT
public:
    explicit BearerAuth(NetClient* client, QObject* parent = nullptr);

    // 设置当前 Token
    void setToken(const QString& token);

    // 设置刷新回调（401 时自动调用）
    void setRefreshCallback(std::function<QString()> fn);

    // 自动重试包装：收到 401 时刷新 Token 并重试原请求
    template<typename F>
    void authenticatedRequest(F&& requestFn) {
        QString token = m_token;
        if (token.isEmpty()) {
            qWarning() << "BearerAuth: token is empty, request will likely fail";
        }
        requestFn(token);
    }

    // 在 NetResponse 回调里判断是否需要刷新
    void handleResponse(const NetResponse& resp,
                        const std::function<void(const NetResponse&)>& onSuccess,
                        const std::function<void(const NetResponse&)>& onError);

signals:
    void tokenRefreshed(const QString& newToken);
    void tokenExpired();

private:
    NetClient* m_client;
    QString m_token;
    std::function<QString()> m_refreshFn;
    bool m_isRefreshing = false;          // 防止并发刷新
    QQueue<std::function<void()>> m_pendingRequests; // 刷新期间排队的请求
};
```

`m_pendingRequests` 的设计参考了 axios 的请求拦截器模式：第一个请求收到 401 后，触发 Token 刷新，在刷新期间后续请求进入排队队列，刷新完成后依次重试队列中的请求。这解决了 AuditScreen BaseApi 里"401 后原请求没重试"的问题。

**RsaCookieAuth：RSA 加密 + Cookie 管理**

这是 CorpHub 的场景，最复杂：

```cpp
class RsaCookieAuth : public QObject {
    Q_OBJECT
public:
    explicit RsaCookieAuth(NetClient* client, QObject* parent = nullptr);

    // 设置 RSA 公钥（从后端获取或写死在代码里）
    void setPublicKey(const QString& pemOrJson);

    // 登录：自动 RSA 加密密码，发 POST，获取 Cookie
    void login(const QString& loginUrl,
               const QString& username, const QString& password,
               const QVariantMap& extraFields,  // CorpHub 那种二十多个额外字段
               std::function<void(bool, const QString& errorMsg)> cb);

    // 检查登录状态
    bool isLoggedIn() const;
    void logout(std::function<void()> cb);

    // 获取绑定了当前 Cookie 的 NetClient
    NetClient* authenticatedClient();

signals:
    void loginStatusChanged(bool isLoggedIn);

private:
    QString rsaEncrypt(const QString& plainText);
    NetClient* m_client;
    QString m_publicKey;
    bool m_loggedIn = false;
};
```

注意到 `extraFields` 参数了吗？这是从 CorpHub 学到的：**不要假定登录表单只有用户名和密码**。实际的内部系统登录表单可能有几十个隐藏字段，有的跟安全相关（`execution`、`_eventId`），有的跟业务相关（`loginType`、`geolocation`）。把这些字段的决策权交给调用方，而不是硬编码在库里。

### 迁移路径：从 QtAuthNet 到 QtNet + QtAuth

已有的 QtAuthNet 用户，不需要重写代码，可以分两步迁移：

**第一步：用 NetClient 替换 QNetworkAccessManager 裸调用**

原有的网络代码中，`QNetworkAccessManager` 发起的请求，改为 `NetClient`。这一层迁移收益立竿见影：超时和重试立即生效，错误分类立即可用。

**第二步：在 NetClient 之上叠加 QtAuth 认证层**

原有的认证逻辑（Token 管理、Cookie 管理），改为使用对应的 `*Auth` 类。由于两层是独立的，认证层可以随时替换，不影响已经调试好的网络层。

迁移成本估算：对于一个 500 行网络层的项目，完整迁移约需 1-2 天。节省下来的维护成本（不需要自己修超时 bug、不需要自己实现重试逻辑）大约是同一时间量级的两到三倍。

---

## 结语

三个项目适配失败，不是一次失败，是三次确认：

**真正的痛点从来不在表层。在表层修修补补，不如回到底层重新想清楚。**

过度抽象一个不存在的标准，不如踏踏实实做好三个真实的需求：超时、重试、错误分类。这三件事加起来不到 200 行代码，但每个 Qt 项目都在为此付出重复成本。

QtNet 这条路，值得重走一遍。
