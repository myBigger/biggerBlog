---
author: 必哥
pubDatetime: 2026-03-28T00:00:00.000Z
title: 【QtAuthNet 开源系列 ⑦】完整设计文档：模块、API与实施计划
slug: qtauthnet-07-design
featured: false
draft: false
tags:
  - Qt
  - QtAuthNet
  - 开源
  - 架构设计
  - API
description: 完整API、目录结构、CAS JSON配置模板、4阶段计划
---

> 作者：必哥百炼计划  
> 前置阅读：系列①-⑥  
> 项目路径：桌面/CodeProjects/03_Backend/QtAuthNet/DESIGN.md

---

## 一、项目概述

**QtAuthNet** — Qt 认证网络框架

> 统一封装 Qt 网络请求中的认证相关逻辑：CAS单点登录、Session管理、Cookie自动刷新、401无感知重试。

---

## 二、核心功能

| 模块 | 功能 |
|------|------|
| HttpClient | 链式调用GET/POST/PUT/DELETE，超时/Header/JSON配置 |
| SessionManager | 统一登录/退出/状态管理，持久化到磁盘 |
| CasClient | CAS 2.0/3.0 单点登录，JSON配置RSA公钥 |
| CookieJar | Cookie自动管理，过期检测，持久化 |
| AuthInterceptor | 全局拦截401，自动刷新Session，静默重发 |
| RequestQueue | Session过期时排队，刷新成功后批量重发 |
| RetryPolicy | 可配置重试策略，指数退避+随机抖动 |
| Config | 全局配置（BaseURL、超时、日志级别、CAS地址） |
| Logger | 分级日志（Debug/Info/Warning/Error），文件+控制台 |

---

## 三、项目结构

```
QtAuthNet/
├── QtAuthNet.pro                 # Qt项目文件
├── include/                      # 公开头文件（对外API）
│   ├── QtAuthNet.h               # 一行引入全部模块
│   ├── HttpClient.h
│   ├── HttpResponse.h
│   ├── SessionManager.h
│   ├── CasClient.h
│   ├── CookieJar.h
│   ├── AuthInterceptor.h
│   ├── RsaHelper.h               # OpenSSL RSA封装
│   ├── Config.h
│   └── Logger.h
├── src/                          # 源文件实现
│   ├── network/                  # 网络层
│   ├── auth/                      # 认证层
│   └── core/                      # 公共工具
├── examples/                     # 示例代码
├── tests/                        # 单元测试
├── configs/                      # 示例配置文件
│   └── cas_config.json           # CAS配置模板
└── README.md                     # 项目说明
```

---

## 四、核心类API

### HttpClient — 链式HTTP客户端

```cpp
class HttpClient : public QObject {
    // 工厂方法
    static HttpClient* get(const QString& url);
    static HttpClient* post(const QString& url);
    
    // 链式配置
    HttpClient* header(const QString& key, const QString& value);
    HttpClient* timeout(int ms);
    HttpClient* json(const QJsonObject& body);
    
    // 回调
    HttpClient* onSuccess(std::function<void(HttpResponse*)> callback);
    HttpClient* onError(std::function<void(int, const QString&)> callback);
    
    void execute();
};
```

### SessionManager — 会话管理器

```cpp
enum class AuthState { NoSession, LoggedIn, LoggedOut, SessionExpired };

class SessionManager : public QObject {
    static SessionManager* instance();
    
    AuthState state() const;
    bool isLoggedIn() const;
    
    void login(const QString& username, const QString& password,
               std::function<void(bool, const QString&)> callback);
    
    void loginByCas(const QString& username, const QString& password,
                    std::function<void(bool, const QString&)> callback);
    
    void logout(std::function<void()> callback = nullptr);
    
signals:
    void stateChanged(AuthState newState);
    void sessionExpired();
};
```

### CasClient — CAS单点登录

```cpp
struct CasConfig {
    QString baseUrl;        // http://cas.company.com
    QString serviceUrl;     // http://app.company.com/callback
    bool validateSsl;       // 内网关掉
};

class CasClient : public QObject {
    explicit CasClient(const CasConfig& config);
    
    void authenticate(const QString& username,
                      const QString& password,
                      std::function<void(bool, const QString&)> callback);
    
    void logout(std::function<void()> callback = nullptr);
};
```

---

## 五、CAS JSON配置文件格式

```json
{
    "baseUrl": "http://cas.company.com",
    "serviceUrl": "http://app.company.com/callback",
    "rsaPublicKey": "-----BEGIN PUBLIC KEY-----\nMIGfMA0GCSqGSIb3...\n-----END PUBLIC KEY-----",
    "validateSsl": false
}
```

---

## 六、实施计划

### Phase 1 — 骨架（第1周）
- [ ] 创建Qt项目，配置pro文件
- [ ] 实现HttpClient GET/POST
- [ ] 实现JsonHelper
- [ ] 实现Logger
- [ ] 实现Config

### Phase 2 — 认证基础（第2周）
- [ ] 实现CookieJar（持久化）
- [ ] 实现SessionManager
- [ ] 实现RsaHelper（OpenSSL RSA封装）
- [ ] 实现AuthInterceptor
- [ ] 实现RequestQueue

### Phase 3 — CAS集成（第3周）
- [ ] 实现CasClient（CAS 2.0/3.0）
- [ ] 对接CAS + SessionManager
- [ ] 完整流程测试

### Phase 4 — 完善（第4周）
- [ ] 单元测试
- [ ] API.md文档
- [ ] README.md
- [ ] GitHub发布

---

## 七、关键设计决策速查

| 问题 | 决策 |
|------|------|
| 同步/异步 | 全部异步 |
| Manager类 | 单例 |
| RSA库 | OpenSSL（统一） |
| Botan | 放弃 |
| CAS公钥 | JSON配置文件 |
| Qt版本 | 5.15+ / 6 双支持 |

---

*文档版本：v1.0.0 | 更新日期：2026-03-28*
*本文是 QtAuthNet 开源系列第7篇（完结篇）*