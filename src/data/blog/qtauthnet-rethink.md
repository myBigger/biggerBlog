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

这次复盘让我对"做开源项目"这件事有了新的理解。

**开源项目的价值，不在于解决了你想解决的问题，而在于解决了真实用户真正存在的问题。**

QtAuthNet 的 README 写得很漂亮："让 Qt HTTP 请求从繁琐变简洁"。这句话在技术上是对的，但在实际场景里，没有人在乎"代码是不是繁琐"。

大家在乎的是：
- 网络抖动后会不会自动重试？
- 请求超时了用户等多久？
- 出错了有没有友好的错误提示？

这些问题 QtAuthNet 一个都没解决。

**写库的人最容易犯的错，是把自己的需求当成用户的需求。**

我需要从"我要做一个简洁的 HTTP 库"，变成"Qt 桌面开发者需要什么样的网络基础设施"。

这两件事，差别巨大。

---

## 结语

三个项目适配失败，不是一次失败，是三次确认：

**真正的痛点从来不在表层。在表层修修补补，不如回到底层重新想清楚。**

QtNet 这条路，值得重走一遍。
