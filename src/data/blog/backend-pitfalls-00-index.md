---
author: 必哥
pubDatetime: 2026-05-28T06:00:00.000Z
title: 后端踩坑手记 — 目录索引
slug: backend-pitfalls-index
featured: false
draft: false
tags:
  - 后端踩坑手记
  - SpringBoot
  - BPM
description: 后端踩坑手记连载目录：MyBatis-Plus、Flowable BPM、快照审批与联调陷阱，从 Wiki 脱敏迁移的实战记录。
---

> 系列：**后端踩坑手记** · 写作细则见仓库内 `docs/blog-style-guide.md`

---

## 已发布

| 期 | 标题 | 核心 |
|----|------|------|
| 1 | [MyBatis-Plus 为什么写不进 NULL](/posts/backend-pitfalls-01-mybatis-null) | `updateById` 忽略 null 字段 |
| 2 | [为什么 BPM 下一节点办理人总是空？](/posts/backend-pitfalls-02-bpm-assignee) | 数据权限误伤候选人 |
| 3 | [审批单为什么要「主表+明细+JSON 快照」？](/posts/backend-pitfalls-03-snapshot-bpm) | 快照与 BPM 状态 |
| 4 | [从待办点进审批页，为什么必须带 taskId](/posts/backend-pitfalls-04-bpm-taskid) | 待办跳转 query |

## 排队中

- 第 5 期：首节点自动跳过与 bizStatus
- 第 6 期：LocalDate / 1970 日期
- 第 7 期：驳回后流程实例 ID 未清理

---

[返回首页](/) · 标签 [后端踩坑手记](/tags/后端踩坑手记/)
