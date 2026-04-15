---
author: 必哥
pubDatetime: 2026-04-15T00:00:00.000Z
title: QtAuthNet 开源系列文章 — 目录索引
slug: qtauthnet-index
featured: true
draft: false
tags:
  - Qt
  - QtAuthNet
  - 开源
  - 架构设计
description: QtAuthNet 开源系列文章完整目录索引，含起源、架构、CAS协议、SSL真相、CI/CD 等全部文章链接
---

> 整理：必哥百炼计划
> 更新时间：2026-04-15

---

## 系列介绍

QtAuthNet 是必哥自研的轻量级 Qt HTTP 认证库，**只依赖 QtCore + QtNetwork**，支持 Bearer Token、HTTP Basic Auth、API Key 三种认证方式，CAS 2.0 单点登录开箱即用。

GitHub：[github.com/myBigger/QtAuthNet](https://github.com/myBigger/QtAuthNet)

---

## 文章列表

### 必哥手记系列（深度长文）

| 编号 | 标题 | 核心内容 |
|------|------|---------|
| ② | [QtAuthNet 设计手记：架构思路与踩坑全记录](/blog/qtauthnet-design) | 整体架构、正交认证设计、CAS 协议实现、std::function 回调存储、跨平台共享库坑、双平台 CI/CD 血泪史 | 2026-04-15 |

### QtAuthNet 体系化系列

| 编号 | 标题 | 核心内容 |
|------|------|---------|
| ① | [起源：为什么要做一个自己的Qt网络认证框架](/blog/qtauthnet-01-origin) | 项目背景、三个痛点、技术选型初衷 | 2026-03-28 |
| ② | [四层架构：AuthInterceptor如何统一处理401](/blog/qtauthnet-02-architecture) | 架构图、AuthInterceptor流程、排队重发、完整数据流 | 2026-03-28 |
| ③ | [CAS单点登录：协议、时序图与JSON配置公钥方案](/blog/qtauthnet-03-cas) | CAS协议12步时序图、JSON配置公钥方案对比、CasClient设计 | 2026-03-28 |
| ④ | [RSA加密选型：OpenSSL vs Botan 完整复盘](/blog/qtauthnet-04-rsa) | Botan vs OpenSSL分析、决策逻辑链、最终结论 | 2026-03-28 |
| ⑤ | [Qt SSL真相：Qt5用OpenSSL，Qt6用Schannel](/blog/qtauthnet-05-ssl) | Qt5/6 SSL后端差异、Schannel vs SecureTransport、常见坑 | 2026-03-28 |
| ⑥ | [目标平台与依赖决策汇总](/blog/qtauthnet-06-platform) | 开发机/目标机矩阵、依赖汇总表、14项设计决策索引 | 2026-03-28 |
| ⑦ | [完整设计文档：模块、API与实施计划](/blog/qtauthnet-07-design) | 完整API、目录结构、CAS JSON配置模板、4阶段计划 | 2026-03-28 |

---

## 精华话题速查

| 话题 | 推荐文章 |
|------|---------|
| 为什么自己做？ | → [① 起源篇](/blog/qtauthnet-01-origin) |
| 架构设计思路 | → [必哥手记② 设计手记](/blog/qtauthnet-design) |
| CAS 单点登录怎么做？ | → [③ CAS篇](/blog/qtauthnet-03-cas) |
| Qt5 和 Qt6 SSL 差异 | → [⑤ SSL真相篇](/blog/qtauthnet-05-ssl) |
| CI/CD 双平台构建 | → [必哥手记② 设计手记](/blog/qtauthnet-design)（第六节） |

---

*整理：必哥百炼计划 ⚡ | QtAuthNet 开源系列*
