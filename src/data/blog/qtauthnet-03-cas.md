---
author: 必哥
pubDatetime: 2026-03-28T00:00:00.000Z
title: 【QtAuthNet 开源系列 ③】CAS单点登录：协议、时序图与JSON配置公钥方案
slug: qtauthnet-03-cas
featured: false
draft: false
tags:
  - Qt
  - QtAuthNet
  - 开源
  - CAS
  - 单点登录
description: CAS协议12步时序图、JSON配置公钥方案对比、CasClient设计
---

> 作者：必哥百炼计划  
> 前置阅读：系列② 架构篇

---

## 一、CAS协议基础

CAS（Central Authentication Service）是企业内网常见的单点登录协议。基本原理：

```
用户 ──→ 访问业务系统 ──→ 发现未登录 ──→ 跳转CAS登录页
                                            │
用户输入用户名密码 ──→ CAS验证 ──→ 颁发Service Ticket
                                            │
用户携带Ticket ──→ 业务系统 ──→ 用Ticket换取用户信息
```

**三个关键接口：**

| 接口 | 用途 | 方法 |
|------|------|------|
| `/cas/login` | 登录页面（GET）和提交认证（POST） | GET/POST |
| `/cas/serviceValidate` | 验证Ticket，换取用户信息 | GET |
| `/cas/logout` | 退出登录 | GET |

---

## 二、完整认证时序图（重点）

这是实际开发中最重要的图，搞清楚这个就知道CAS Client怎么写：

```
用户                应用（Qt）              CAS Server
  │                     │                        │
  │  ①访问业务系统       │                        │
  │─────────────────────>│                        │
  │                     │                        │
  │  ②发现无Session     │                        │
  │                     │  ③GET /cas/login      │
  │                     │   ?service=appUrl      │
  │                     │───────────────────────>│
  │                     │                        │
  │  ④返回登录页面HTML   │<───────────────────────│
  │<─────────────────────│                        │
  │                     │                        │
  │  ⑤用户输入用户名密码 │                        │
  │  （浏览器自动提交）  │                        │
  │─────────────────────>│                        │
  │                     │  ⑥POST /cas/login     │
  │                     │   username=xxx        │
  │                     │   password=（RSA加密） │
  │                     │   lt=loginTicket       │
  │                     │   service=appUrl       │
  │                     │───────────────────────>│
  │                     │                        │
  │  ⑦返回ServiceTicket │<───────────────────────│
  │  （ST-xxxxx）        │                        │
  │<─────────────────────│                        │
  │                     │                        │
  │  ⑧携带Ticket访问     │  ⑨GET /cas/p3/serviceValidate│
  │   （后台自动进行）   │   ?service=appUrl     │
  │─────────────────────>│   ?ticket=ST-xxxxx    │
  │                     │───────────────────────>│
  │                     │                        │
  │                     │ ⑩验证成功，返回用户信息 │
  │                     │   <cas:serviceResponse>│
  │                     │     <cas:user>zhangsan</cas:user>│
  │                     │   </cas:serviceResponse>│
  │                     │<───────────────────────│
  │                     │                        │
  │  ⑪应用保存Session    │                        │
  │   允许访问资源        │                        │
  │<─────────────────────│                        │
```

**关键理解：**
- 第⑤步：密码需要用RSA公钥加密（公钥从第④步的HTML里提取）
- 第⑥步：`lt`参数是CAS的登录票据，防止重复提交
- 第⑧步：这一步是浏览器自动完成的，应用不需要自己发
- 第⑨步：应用后台用 ST 去换取用户身份

---

## 三、CAS Client 模块设计

```cpp
class CasClient : public QObject {
    Q_OBJECT

public:
    struct CasConfig {
        QString baseUrl;       // http://cas.company.com
        QString serviceUrl;     // http://app.company.com/callback
        bool validateSsl;       // 内网HTTP可以关掉
    };

    // 完整CAS认证（login + validate 一气呵成）
    void authenticate(
        const QString& username, 
        const QString& password,  // 明文密码，内部用RSA加密
        std::function<void(bool success, const QString& errorMsg)> callback
    );

    // CAS退出
    void logout(std::function<void()> callback = nullptr);

private:
    void requestServiceTicket(const QString& username,
                               const QString& password,
                               std::function<void(const QString& ticket,
                                                  const QString& error)> callback);

    void doValidate(const QString& ticket,
                     std::function<void(QJsonObject userInfo,
                                        const QString& error)> callback);
};
```

---

## 四、三种公钥方案对比

CAS登录需要用RSA公钥加密密码，有三种方案：

| | 方案A：自动抓HTML | 方案B：JSON配置 | 方案C：硬编码 |
|---|---|---|---|
| 做法 | 框架自动GET登录页解析公钥 | 用户查一次，存JSON文件 | 写死在代码里 |
| 复杂度 | 高（HTML解析脆弱） | 低 | 最低 |
| 健壮性 | 差（CAS改版就挂） | 好 | 好 |
| 用户操作 | 零 | 查一次填JSON | 查一次写代码 |
| 公钥轮换 | 自动适应 | 手动更新JSON | 手动改代码 |

### 最终选择：方案B — JSON配置

**理由：**
1. **公钥极少变动** — 公司内网CAS的公钥可能一年都不换
2. **HTML解析太脆弱** — CAS页面改一次DOM结构，框架就废了
3. **符合框架定位** — 框架做"统一封装"，不帮用户做"一次性操作"
4. **有实践经验** — 开发者之前就是这样做的，经验证可行

### JSON配置文件格式

```json
// cas_config.json
{
    "baseUrl": "http://cas.company.com",
    "serviceUrl": "http://app.company.com/callback",
    "rsaPublicKey": "-----BEGIN PUBLIC KEY-----\nMIGfMA0GCSqGSIb3DQEBAQUAA...\n-----END PUBLIC KEY-----",
    "validateSsl": false
}
```

---

## 五、CasClient完整认证流程代码

```cpp
void CasClient::authenticate(const QString& username,
                              const QString& password,
                              std::function<void(bool, const QString&)> callback)
{
    // 步骤1：从JSON加载配置（或者直接传入）
    // 步骤2：用公钥加密密码
    QString encryptedPassword = RsaHelper::encrypt(password, m_config.rsaPublicKey);
    
    // 步骤3：从登录页获取lt（login ticket）
    fetchLoginTicket([=](QString lt, QString ltError) {
        if (!lt.isEmpty()) {
            // 步骤4：POST /cas/login 提交认证
            requestServiceTicket(username, encryptedPassword, lt,
                [=](QString ticket, QString ticketError) {
                if (!ticket.isEmpty()) {
                    // 步骤5：用ST验证，换取用户信息
                    doValidate(ticket, [=](QJsonObject userInfo, QString validateError) {
                        if (!userInfo.isEmpty()) {
                            // 步骤6：通知SessionManager保存会话
                            SessionManager::instance()->saveSession(userInfo);
                            callback(true, "");
                        } else {
                            callback(false, validateError);
                        }
                    });
                } else {
                    callback(false, ticketError);
                }
            });
        } else {
            callback(false, ltError);
        }
    });
}
```

---

## 六、与SessionManager的集成

```cpp
void SessionManager::loginByCas(const QString& username,
                                  const QString& password,
                                  std::function<void(bool, const QString&)> callback)
{
    CasClient* cas = new CasClient(m_casConfig);
    cas->authenticate(username, password, [=](bool ok, const QString& err) {
        if (ok) {
            // 保存到磁盘
            saveToDisk();
            emit loginSuccess(userId);
            emit stateChanged(AuthState::LoggedIn);
        }
        callback(ok, err);
    });
}
```

---

## 七、常见CAS版本差异

| 版本 | 验证接口 | 返回格式 | 兼容性 |
|------|---------|---------|-------|
| CAS 2.0 | `/cas/serviceValidate` | XML | 旧系统 |
| CAS 3.0 | `/cas/p3/serviceValidate` | JSON（推荐） | 主流 |
| CAS 4.0+ | `/cas/oauth2.0/accessToken` | OAuth2 | 新系统 |

QtAuthNet 会同时支持 CAS 2.0 和 3.0，自动选择合适的接口。

---

下一期：**RSA加密选型：OpenSSL vs Botan 完整复盘**