---
author: 必哥
pubDatetime: 2026-03-28T00:00:00.000Z
title: QtAuthNet 开源系列文章 — 目录索引
slug: qtauthnet-index
featured: false
draft: false
tags:
  - Qt
  - QtAuthNet
  - 开源
  - 架构设计
description: QtAuthNet 开源系列文章目录索引
---

> 整理：必哥百炼计划  
> 整理时间：2026-03-28

## 文章列表

| 编号 | 文件名 | 核心内容 | 字数约 |
|------|--------|---------|--------|
| ① | 01_起源为什么要做QtAuthNet框架.md | 项目背景、三个痛点、技术选型初衷 | ~2,400字 |
| ② | 02_四层架构AuthInterceptor统一处理401.md | 架构图、AuthInterceptor流程、排队重发、完整数据流 | ~4,700字 |
| ③ | 03_CAS单点登录协议时序图JSON配置公钥.md | CAS协议12步时序图、JSON配置公钥方案对比、CasClient设计 | ~6,900字 |
| ④ | 04_RSA加密选型OpenSSLvsBotan完整复盘.md | Botan vs OpenSSL分析、决策逻辑链、最终结论 | ~3,800字 |
| ⑤ | 05_Qt_SSL真相Qt5用OpenSSLQt6用Schannel.md | Qt5/6 SSL后端差异、Schannel vs SecureTransport、常见坑 | ~4,500字 |
| ⑥ | 06_目标平台与依赖决策汇总.md | 开发机/目标机矩阵、依赖汇总表、14项设计决策索引 | ~2,900字 |
| ⑦ | 07_完整设计文档模块API实施计划.md | 完整API、目录结构、CAS JSON配置模板、4阶段计划 | ~6,700字 |

## 精华话题索引

### 话题一：为什么要做这个框架？
→ 01_起源篇

### 话题二：AuthInterceptor如何工作？
→ 02_四层架构篇

### 话题三：CAS单点登录怎么做？
→ 03_CAS篇

### 话题四：RSA加密用OpenSSL还是Botan？
→ 04_RSA选型篇

### 话题五：Qt5和Qt6的SSL有什么区别？
→ 05_SSL真相篇

### 话题六：目标平台有哪些？
→ 06_汇总篇

### 话题七：完整设计是什么样的？
→ 07_设计文档篇

---

*整理：必哥百炼计划 ⚡ | QtAuthNet 开源系列*