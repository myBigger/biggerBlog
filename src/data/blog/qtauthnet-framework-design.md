---
author: 必哥
pubDatetime: 2026-03-24T00:00:00.000Z
title: QtAuthNet - Qt认证网络框架设计文档
slug: qtauthnet-framework-design
featured: false
draft: false
tags:
  - Qt
  - C++
  - 网络
  - 认证
  - 架构设计
  - 教程
description: 一个完整的Qt网络认证框架架构设计，涵盖CAS单点登录、HTTP请求、Cookie管理、Session刷新等核心功能。
---

> 本文档是框架的完整架构设计，所有代码实现前必须先理解此文档。

---

## 一、设计目标与背景

### 解决的实际痛点

| 痛点 | 现状 | 目标 |
| ------------------ | ----------------------------- | ------------------- |
| CAS单点登录 | 每次项目都重写，代码散乱 | 统一CasClient模块 |
| HTTP登录/退出 | 逻辑分散在各处 | SessionMgr统一管理 |
| Cookie过期刷新 | 401后手动重试，用户需重新登录 | 自动检测+无感知刷新 |
| 网络代码风格不统一 | 每个人写法不同 | 链式调用，风格一致 |
| 401处理逻辑混乱 | 散落在各处try-catch | 全局拦截+排队重发 |

### 核心设计原则

1. **链式调用**：所有配置可连贯书写
2. **静默刷新**：用户无感知，自动续命Session
3. **请求排队**：Session过期时，排队自动重发
4. **零外部依赖**：只用Qt官方模块，不引入第三方库
5. **线程安全**：异步操作全部在独立线程

---

## 二、系统架构总览

```
┌─────────────────────────────────────────────────────────┐
│ 用户调用层 │
│ HttpClient / CasClient / SessionMgr / CookieJar │
└──────────────────────┬──────────────────────────────────┘
 │
┌──────────────────────▼──────────────────────────────────┐
│ Auth拦截层 │
│ AuthInterceptor (注入Header、处理401、自动刷新Token) │
└──────────────────────┬──────────────────────────────────┘
 │
┌──────────────────────▼──────────────────────────────────┐
│ RequestQueue │
│ (Session过期时排队，刷新后自动重发) │
└──────────────────────┬──────────────────────────────────┘
 │
┌──────────────────────▼──────────────────────────────────┐
│ NetworkCore │
│ QNetworkAccessManager QNetworkCookieJar │
└──────────────────────┬──────────────────────────────────┘
 │
┌──────────────────────▼──────────────────────────────────┐
│ Qt网络层 │
│ QNetworkAccessManager │
└─────────────────────────────────────────────────────────┘
```

---

## 三、模块详细设计

### 3.1 NetworkCore 模块（基础设施）

#### HttpClient — 链式HTTP客户端

核心类: HttpClient

**链式调用设计：**

```cpp
// 基础GET
HttpClient::get("https://api.example.com/users")
    .header("Accept", "application/json")
    .timeout(5000)
    .execute();

// POST JSON
HttpClient::post("https://api.example.com/login")
    .json(bodyJson) // 自动设置 Content-Type: application/json
    .timeout(8000)
    .execute();

// 上传文件
HttpClient::upload("https://api.example.com/upload")
    .file("file", "/path/to/file.jpg")
    .onProgress([](qint64 sent, qint64 total) {
        qDebug() << "上传进度:" << sent << "/" << total;
    })
    .execute();
```

---

### 3.2 Auth 模块（核心模块）

#### AuthInterceptor — 认证拦截器（核心枢纽）

这是整个框架的**调度中心**，所有请求都经过这里。

**核心流程：**

```
用户发起请求
 │
 ▼
prepare() 注入Cookie/Token到Header
 │
 ▼
Qt网络层发送请求
 │
 ▼
收到响应
 │
 ├─── 2xx ──→ 触发 onSuccess()，流程结束
 │
 ├─── 401 ──→ handleUnauthorized()
 │    │
 │    ▼
 │    检查是否正在刷新
 │    │
 │    ├── 否 → 开始刷新Token
 │    │    原始请求加入RequestQueue排队
 │    │    刷新成功后重发排队请求
 │    │
 │    └── 是 → 原始请求加入RequestQueue排队
 │         等刷新完成后再重发
 │
 └─── 其他错误码 ──→ 触发 onError()
```

---

#### SessionManager — 会话管理器

```cpp
enum class AuthState {
    NoSession,      // 从未登录过
    LoggedIn,       // 已登录
    LoggedOut,      // 已主动退出
    SessionExpired  // Session过期，需刷新
};
```

**功能：**
- 登录/退出管理
- Session状态追踪
- Token/Cookie刷新
- 持久化到磁盘

---

## 四、关键设计决策

### Q1: 同步还是异步？

**决策：全部异步，execute() 同步版仅用于测试/调试**

理由：网络请求在真实项目中99%是异步，同步调用会卡UI线程。

---

### Q2: 单例还是依赖注入？

**决策：Manager类用单例，HttpClient每次new**

- SessionManager 全局一个 → 单例
- HttpClient 每次请求独立 → 每次new

---

## 五、阶段实施计划

### Phase 1 — 骨架（第1周）

- [ ] 创建Qt项目，配置pro文件
- [ ] 实现HttpClient GET/POST（不含认证）
- [ ] 实现JsonHelper
- [ ] 实现Logger
- [ ] 实现Config

### Phase 2 — 认证基础（第2周）

- [ ] 实现CookieJar（持久化）
- [ ] 实现SessionManager（登录/退出/状态）
- [ ] 实现AuthInterceptor（拦截401）
- [ ] 实现RequestQueue（排队重发）

### Phase 3 — CAS集成（第3周）

- [ ] 实现CasClient（CAS 2.0）
- [ ] 集成CAS + SessionManager
- [ ] 对接AuthInterceptor

### Phase 4 — 完善与文档（第4周）

- [ ] 内存泄漏检测
- [ ] 写API.md文档
- [ ] 整理examples示例代码
- [ ] 发布GitHub开源

---

## 六、后续扩展方向

- HTTPS/WebSocket统一接口
- API限流控制
- 本地缓存
- QML绑定
- AI集成（封装OpenAI/Claude API调用）

---

*文档版本: v1.0.0 | 最后更新: 2026-03-24*