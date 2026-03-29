---
author: 必哥
pubDatetime: 2026-03-28T00:00:00.000Z
title: 【QtAuthNet 开源系列 ⑥】目标平台与依赖决策汇总
slug: qtauthnet-06-platform
featured: false
draft: false
tags:
  - Qt
  - QtAuthNet
  - 开源
  - 平台
  - 决策
description: 开发机/目标机矩阵、依赖汇总表、14项设计决策索引
---

> 作者：必哥百炼计划  
> 前置阅读：系列①-⑤

---

## 一、开发环境 vs 目标环境

做Qt开发经常混淆两个概念：

| | 说明 |
|---|---|
| **开发环境** | 你写代码、编译用的机器 |
| **目标环境** | 用户实际运行的机器 |

**开发环境用什么系统，不影响框架设计。目标环境才影响。**

---

## 二、目标平台矩阵

| 目标平台 | Qt版本 | HTTPS | RSA加密 | OpenSSL DLL |
|---------|--------|-------|---------|------------|
| **Windows x64 AMD64** | Qt 5.15+ | OpenSSL（DLL） | OpenSSL | 必须带 |
| **Windows x64 AMD64** | Qt 6 | Schannel（原生） | OpenSSL | 可选 |
| **Linux x64** | Qt 5.15+ / 6 | OpenSSL | OpenSSL | 系统自带 |
| **macOS** | Qt 5.15+ / 6 | SecureTransport | OpenSSL | Homebrew装 |

---

## 三、依赖决策汇总

```
依赖项       用途                    覆盖范围
───────────────────────────────────────────────────────
OpenSSL     RSA公钥加密（CAS用）     所有平台
OpenSSL     HTTPS请求（Qt5 Windows） Qt 5 Windows必须带
Schannel    HTTPS请求（Qt6 Windows）  Qt 6 Windows原生
SecureTransport HTTPS（macOS）       macOS原生
```

**只有一组外部依赖：OpenSSL。**

---

## 四、关键设计决策索引

| 编号 | 决策 | 结论 |
|------|------|------|
| D1 | 同步/异步 | 全部异步 |
| D2 | 单例/依赖注入 | Manager单例 |
| D3 | RSA加密库 | 统一用 OpenSSL |
| D4 | Botan | 放弃，不引入 |
| D5 | HTTPS Qt5 | OpenSSL DLL |
| D6 | HTTPS Qt6 Win | Schannel原生 |
| D7 | CAS公钥来源 | JSON配置文件 |
| D8 | Qt版本 | 同时支持 Qt 5.15+ 和 Qt 6 |

---

下一期：**完整设计文档：模块、API、实施计划**