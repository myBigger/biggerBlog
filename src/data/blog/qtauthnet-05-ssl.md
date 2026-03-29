---
author: 必哥
pubDatetime: 2026-03-28T00:00:00.000Z
title: 【QtAuthNet 开源系列 ⑤】Qt SSL真相：Qt5用OpenSSL，Qt6用Schannel
slug: qtauthnet-05-ssl
featured: false
draft: false
tags:
  - Qt
  - QtAuthNet
  - 开源
  - SSL
  - OpenSSL
description: Qt5/6 SSL后端差异、Schannel vs SecureTransport、常见坑
---

> 作者：必哥百炼计划  
> 前置阅读：系列④ RSA选型篇

---

## 一、很多人搞不清楚的一件事

很多人以为"Qt 的 SSL 底层是 OpenSSL"，这句话对了一半。

实际上：

> **Qt 用什么做 SSL，跟 Qt 版本、操作系统、编译选项都有关。**

Qt 6 彻底改变了这件事。

---

## 二、Qt 5 的 SSL 后端

**Qt 5 所有平台的 SSL 后端都是 OpenSSL。**

| 平台 | SSL后端 | 备注 |
|------|--------|------|
| Windows | OpenSSL | 需要 DLL |
| macOS | OpenSSL | 需要安装 |
| Linux | OpenSSL | 系统自带 |

---

## 三、Qt 6 的 SSL 后端（变化很大）

Qt 6 做了一个重大改变：**移除了对 OpenSSL 的硬依赖**，改用平台原生 TLS。

| 平台 | SSL后端 | OpenSSL依赖 |
|------|--------|------------|
| Windows | **Schannel**（原生） | ❌ 不需要 |
| macOS | **SecureTransport**（原生） | ❌ 不需要 |
| Linux | OpenSSL 或系统后端 | ⚠️ 视编译配置而定 |

### 为什么 Qt 6 要改？

1. **苹果强制要求** — macOS App Store 要求用苹果自己的 TLS 实现
2. **Windows 原生 TLS** — Schannel 是 Windows 原生，安全更新跟随系统
3. **减少依赖** — OpenSSL 历史上有过多次安全漏洞

---

## 四、对开发者的实际影响

### Windows 开发者感受最明显

**Qt 5 Windows：**
需要带上 OpenSSL DLL，否则 HTTPS 请求失败。

**Qt 6 Windows：**
用 Windows 原生 Schannel，开箱即用，不需要任何 SSL DLL。

---

## 五、验证SSL是否正常工作的简单方法

```cpp
void testHttps()
{
    QNetworkAccessManager mgr;
    QNetworkReply* reply = mgr.get(QNetworkRequest(QUrl("https://www.google.com")));
    QObject::connect(reply, &QNetworkReply::finished, [&]() {
        if (reply->error() == QNetworkReply::NoError) {
            qDebug() << "HTTPS正常!";
        } else {
            qDebug() << "HTTPS失败:" << reply->errorString();
        }
        reply->deleteLater();
    });
}
```

---

## 六、常见坑

| 现象 | 原因 | 解决 |
|------|------|------|
| Qt 5 Windows HTTPS 超时 | 缺 OpenSSL DLL | 带上 DLL |
| macOS HTTPS 失败 | 没装 OpenSSL | Homebrew装openssl@1.1 |
| Linux HTTPS 失败 | Qt 6 用 GnuTLS 后端 | 换用 OpenSSL 后端 |

---

下一期：**一张表说清楚：目标平台与依赖决策**