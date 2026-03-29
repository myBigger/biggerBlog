---
author: 必哥
pubDatetime: 2026-03-28T00:00:00.000Z
title: 【QtAuthNet 开源系列 ②】四层架构：AuthInterceptor如何统一处理401
slug: qtauthnet-02-architecture
featured: false
draft: false
tags:
  - Qt
  - QtAuthNet
  - 开源
  - 架构设计
  - 网络
description: 架构图、AuthInterceptor流程、排队重发、完整数据流
---

> 作者：必哥百炼计划  
> 前置阅读：系列① 起源篇

---

## 一、整体架构

QtAuthNet 采用四层架构，自顶向下：

```
┌─────────────────────────────────────────┐
│            用户调用层                    │
│  HttpClient / CasClient / SessionMgr    │
└────────────────────┬──────────────────┘
                     │
┌────────────────────▼──────────────────┐
│          Auth 拦截层                     │
│  AuthInterceptor（请求前注入，响应后拦截）│
└────────────────────┬──────────────────┘
                     │
┌────────────────────▼──────────────────┐
│          RequestQueue 排队层            │
│     （401时排队，刷新后自动重发）        │
└────────────────────┬──────────────────┘
                     │
┌────────────────────▼──────────────────┐
│           NetworkCore 网络层            │
│   QNetworkAccessManager + QNetworkCookieJar │
└─────────────────────────────────────────┘
```

**核心思路：** 所有请求都经过 AuthInterceptor，401 处理逻辑只写一次。

---

## 二、第一层：用户调用层

提供简洁的链式API：

```cpp
// GET请求
HttpClient::get("https://api.example.com/users")
    .header("Accept", "application/json")
    .timeout(5000)
    .execute();

// POST JSON
HttpClient::post("https://api.example.com/login")
    .json(QJsonObject{{"username", "admin"}, {"password", "123456"}})
    .timeout(8000)
    .onSuccess([](HttpResponse* res) {
        qDebug() << res->json();
    })
    .onError([](int code, const QString& msg) {
        qDebug() << code << msg;
    })
    .execute();
```

用户完全不需要关心：
- Session 怎么管理
- Cookie 怎么带
- 401 怎么刷新

这些全部在 AuthInterceptor 层处理。

---

## 三、第二层：AuthInterceptor（调度中心）

这是整个框架的核心枢纽，职责：

### 3.1 请求前：注入认证信息

```cpp
void AuthInterceptor::prepare(QNetworkRequest& request)
{
    if (SessionManager::instance()->isLoggedIn()) {
        // 注入Cookie
        QString cookies = SessionManager::instance()->cookies();
        request.setHeader(QNetworkRequest::CookieHeader, cookies);
        
        // 注入Token
        QString token = SessionManager::instance()->accessToken();
        request.setRawHeader("Authorization", "Bearer " + token.toUtf8());
    }
}
```

### 3.2 响应后：处理401

```cpp
void AuthInterceptor::handleResponse(QNetworkReply* reply, 
                                     std::function<void()> originalCallback)
{
    if (reply->attribute(QNetworkRequest::HttpStatusCodeAttribute).toInt() == 401) {
        // 发现401 → 检查是否正在刷新
        if (!m_isRefreshing) {
            m_isRefreshing = true;
            
            // 原始请求加入排队
            RequestQueue::instance()->enqueue(originalRequest);
            
            // 触发Session刷新
            SessionManager::instance()->refreshSession([=](bool success) {
                m_isRefreshing = false;
                if (success) {
                    // 刷新成功 → 重发排队请求
                    RequestQueue::instance()->replayAll(newToken);
                } else {
                    // 刷新失败 → 清空队列，通知用户重新登录
                    RequestQueue::instance()->clear();
                    emit sessionExpired(); // → UI层弹出登录框
                }
            });
        } else {
            // 正在刷新中 → 直接排队
            RequestQueue::instance()->enqueue(originalRequest);
        }
    }
}
```

---

## 四、第三层：RequestQueue（排队重发）

这是"静默刷新"的关键——用户完全无感知。

```
请求A ─┐
请求B ─┼─→ 收到401 ──→ 排队队列 ──→ 刷新Token ──┬─ 成功 ─→ replayAll() ─→ 重发A,B,C
请求C ─┘                                 └─ 失败 ─→ 清空队列 ─→ 用户重新登录
```

**关键设计：**
- 每个请求携带独立的 onSuccess / onError 回调
- 排队时记录原始 headers，刷新后用新 Token 替换旧值
- 刷新失败时逐个调用 onError，避免请求"丢失"
- 队列大小无限制（正常情况最多排几个）

---

## 五、第四层：NetworkCore

底层依赖 Qt 原生网络层：

```cpp
class HttpClient {
private:
    QNetworkAccessManager* m_manager;  // 整个框架共用一个
    
    void sendRequest() {
        // 注入认证信息
        AuthInterceptor::instance()->prepare(m_request);
        
        // 发送
        QNetworkReply* reply = m_manager->get(m_request);
        
        // 接收响应
        connect(reply, &QNetworkReply::finished, this, [=]() {
            AuthInterceptor::instance()->handleResponse(reply, ...);
        });
    }
};
```

---

## 六、完整请求流程全景图

```
用户
  │
  ▼ HttpClient::get(url).execute()
  
构造 QNetworkRequest
  │
  ▼ AuthInterceptor::prepare(request)
  │   ├── 已登录 → 注入 Cookie + Token
  │   └── 未登录 → 直接发送（公开接口）
  │
  ▼ QNetworkAccessManager::get(request)
  
收到响应
  │
  ├── 2xx  → ✅ onSuccess()
  ├── 401  → AuthInterceptor::handleResponse()
  │           │
  │           ├── 未刷新 → 刷新 + 排队 + replayAll
  │           └── 正在刷新 → 排队等刷新信号
  └── 其他  → ❌ onError()
```

---

## 七、与传统方案的对比

| | 传统写法 | QtAuthNet |
|---|---|---|
| 登录代码 | 每个项目写一遍 | `SessionManager::instance()->login()` |
| 401处理 | 散落在各业务代码 | AuthInterceptor统一拦截 |
| Cookie管理 | 手动保存/携带 | CookieJar自动管理 |
| 重试逻辑 | 自己写各种版本 | `HttpClient::retry(3)` |
| 刷新失败 | 没处理/处理不一致 | 全局sessionExpired()信号 |

---

下一期：**CAS单点登录：协议、时序图与JSON配置公钥方案**