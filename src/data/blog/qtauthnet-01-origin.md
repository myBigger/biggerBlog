---
author: 必哥
pubDatetime: 2026-03-28T00:00:00.000Z
title: 【QtAuthNet 开源系列 ①】起源：为什么要做一个自己的Qt网络认证框架
slug: qtauthnet-01-origin
featured: false
draft: false
tags:
  - Qt
  - QtAuthNet
  - 开源
  - 架构设计
  - 网络
description: 项目背景、三个痛点、技术选型初衷
---

> 作者：必哥百炼计划  
> 时间：2026-03  
> 状态：已完成设计，待代码实现

---

## 一、故事的起点

做Qt开发久了，总会遇到这样的代码：

```cpp
// 项目A - 登录
void login(const QString& user, const QString& pass) {
    QNetworkAccessManager* mgr = new QNetworkAccessManager(this);
    QNetworkRequest req;
    req.setUrl(QUrl("https://api.example.com/login"));
    req.setHeader(QNetworkRequest::ContentTypeHeader, "application/json");
    
    QJsonObject obj;
    obj.insert("username", user);
    obj.insert("password", pass);
    
    QNetworkReply* reply = mgr->post(req, QJsonDocument(obj).toJson());
    connect(reply, &QNetworkReply::finished, this, [=]() {
        // 处理响应...
        qDebug() << reply->readAll();
    });
}
```

然后下一个项目，又是类似的代码，但略有不同。再下一个项目，又是另一个版本。

三年下来，代码散落在十几个项目里，每次接新项目都要重新写一遍，或者从老项目里复制粘贴，修修改改。

**这就是做Qt网络开发的人，最真实的痛点。**

---

## 二、三个真实痛点

### 痛点1：CAS单点登录每次重写

公司有内网统一认证平台，每次接新项目都要：
- 研究CAS协议（GET /cas/login → POST /cas/login → GET /cas/serviceValidate）
- 处理RSA加密（公钥在前端HTML里，每次找一遍）
- 写登录逻辑、退出逻辑、Session管理

**每次都重写，每次都踩坑。**

### 痛点2：401处理逻辑散落各处

网络请求遇到401（会话过期），标准处理流程是：
1. 尝试刷新Session
2. 刷新成功后排队重发原请求
3. 刷新失败则弹窗让用户重新登录

这个逻辑在每个业务代码里都写一遍，而且写法不统一，有的直接崩，有的没处理。

### 痛点3：Cookie管理混乱

登录后返回的Cookie，需要手动保存、下次请求时手动带上。Cookie什么时候过期、要不要刷新，全部靠业务代码自己判断。

---

## 三、解决方案：QtAuthNet

这个开源框架的目标很简单：

> **把Qt网络请求中所有跟"认证"相关的代码，统一封装成一套可复用的框架。**

具体来说：

| 功能 | 现状 | QtAuthNet |
|------|------|-----------|
| HTTP请求 | 每次new QNetworkAccessManager | `HttpClient::get(url).execute()` |
| CAS登录 | 每个项目重写 | `SessionManager::loginByCas()` |
| 401处理 | 散落各处 | AuthInterceptor统一拦截 |
| Cookie管理 | 手动管理 | CookieJar自动管理+持久化 |
| 重试逻辑 | 自己写 | RetryPolicy可配置 |

---

## 四、技术栈与定位

- **语言**：C++（Qt）
- **版本支持**：Qt 5.15+ 和 Qt 6
- **目标平台**：Windows x64 + Linux
- **协议支持**：HTTP、HTTPS、CAS 2.0/3.0
- **核心依赖**：OpenSSL（用于RSA加密，Qt 5 HTTPS）
- **设计原则**：链式调用、零外部依赖（除OpenSSL）、线程安全

---

## 五、项目结构预览

```
QtAuthNet/
├── include/          # 对外API头文件
│   ├── HttpClient.h
│   ├── SessionManager.h
│   ├── CasClient.h
│   └── CookieJar.h
├── src/
│   ├── network/      # 网络层实现
│   ├── auth/         # 认证层实现
│   └── core/         # 公共工具
└── README.md
```

---

## 六、开源系列文章规划

本文是这个系列的第一篇，后续会陆续更新：

1. ✅ 起源：为什么要做这个框架（本文）
2. ⏳ 四层架构：AuthInterceptor如何统一处理401
3. ⏳ CAS单点登录：协议、时序图与JSON配置公钥方案
4. ⏳ RSA加密选型：OpenSSL vs Botan完整复盘
5. ⏳ Qt SSL真相：Qt5和Qt6在Windows上的差异
6. ⏳ 一张表说清楚：目标平台与依赖决策
7. ⏳ 完整设计文档：模块、API、实施计划

---

**欢迎关注、交流！如果你也有类似的痛点，欢迎一起完善这个框架。**