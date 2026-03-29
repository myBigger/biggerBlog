---
author: 必哥
pubDatetime: 2026-03-28T00:00:00.000Z
title: 【QtAuthNet 开源系列 ④】RSA加密选型：OpenSSL vs Botan 完整复盘
slug: qtauthnet-04-rsa
featured: false
draft: false
tags:
  - Qt
  - QtAuthNet
  - 开源
  - RSA
  - OpenSSL
description: Botan vs OpenSSL分析、决策逻辑链、最终结论
---

> 作者：必哥百炼计划  
> 前置阅读：系列②架构篇 + 系列③CAS篇

---

## 一、问题的起源

做CAS登录，密码要用RSA公钥加密。Qt本身没有提供RSA加密的原生API，于是面临三个选择：

- **方案A：OpenSSL** — C语言底层加密库，工业标准
- **方案B：Botan** — 现代C++加密库， header-only风格
- **方案C：Qt-Secret** — Qt开源加密库，底层也是OpenSSL

这个选择花了比较长的时间讨论，因为三个方案各有利弊。

---

## 二、Botan方案的分析

Botan 是一个现代 C++ 加密库，设计理念很干净：

**优点：**
- C++ 风格 API，比 OpenSSL 的 C 语言接口好写很多
- 有 header-only 模式，不用非得编译成 .so/.dll
- Windows ARM 支持良好
- 单一库文件，依赖干净

**缺点（关键）：**
- Botan 不能解决 Qt 访问 HTTPS 的问题
- Qt 的 QNetworkAccessManager 做 HTTPS 请求，走的是 Qt 自己的 SSL 后端
- 如果 Qt 5 Windows 用了 OpenSSL 做 SSL，则 OpenSSL DLL 无论如何都要带
- 再加一个 Botan，等于多引入一组依赖

---

## 三、OpenSSL方案的分析

OpenSSL 是工业标准，但使用它确实需要动态链接库：

### 各平台情况

| 平台 | Qt 5 SSL后端 | Qt 6 SSL后端 | RSA用OpenSSL |
|------|-------------|-------------|-------------|
| Windows x64 | OpenSSL（DLL） | **Schannel**（原生） | ✅ 可以 |
| Linux | OpenSSL | OpenSSL/系统 | ✅ 可以 |
| macOS | SecureTransport | SecureTransport | ⚠️ 需装OpenSSL |
| Windows ARM | OpenSSL（DLL难找） | Schannel（原生） | ⚠️ 需找ARM版 |

### Qt 5 Windows 的实际情况（重点）

Qt 5 Windows 上，QNetworkAccessManager 访问 HTTPS：
- **底层依赖 OpenSSL**
- 需要 `libssl-1_1-x64.dll` + `libcrypto-1_1-x64.dll`
- 这些 DLL **无论如何都要带**
- OpenSSL 官方下载地址：[slproweb.com](https://slproweb.com/products/Win32OpenSSL.html)（找 Win64 版本）

所以：

> **Qt 5 Windows 用户：OpenSSL DLL 无论如何要带，多一个 RSA 加密调用 OpenSSL 完全不增加额外负担。**

### Qt 6 Windows 的情况

Qt 6 移除了对 OpenSSL 的硬依赖，Windows 用 Schannel（Windows 原生 TLS）。

**这带来一个问题：** Qt 6 Windows 可以不带 OpenSSL 做 HTTPS。但 RSA 加密还是需要加密库。

两个选择：
1. **继续用 OpenSSL** — DLL 单独装，用户多一个依赖，但统一技术栈
2. **用 Botan** — 干净的单一依赖，但 HTTPS 不用它

---

## 四、最终决策

### 最终结论：**统一用 OpenSSL，Botan 放弃**

逻辑链：

```
Qt 5 Windows ─→ HTTPS需要OpenSSL DLL ─→ 已经要带 ─→ RSA直接用OpenSSL，不额外加Botan

Qt 6 Windows ─→ HTTPS用Schannel（原生） ─→ 不需要OpenSSL ─→ 但Qt 6 Windows也可以装OpenSSL

Linux ─→ OpenSSL系统自带 ─→ 直接用
macOS ─→ 可以装OpenSSL ─→ 直接用
```

**结论：** 统一技术栈，只用 OpenSSL 一组依赖。

---

## 五、OpenSSL的使用方式

QtAuthNet 会封装一个 RsaHelper，对外提供干净接口：

```cpp
// rsa_helper.h
class RsaHelper {
public:
    // 用公钥加密密码（CAS登录用这个）
    static QString encryptByPublicKey(const QString& plainText,
                                        const QString& publicKeyPem);
};
```

---

下一期：**Qt SSL真相：Qt5和Qt6在Windows上的差异**