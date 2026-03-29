---
author: 必哥
pubDatetime: 2026-03-23T00:00:00.000Z
title: 金士顿固态硬盘速度跑不满？可能是拓展坞的坑
slug: ssd-speed-issue
featured: false
draft: false
tags:
  - 踩坑记录
  - 硬件
  - Mac
  - Parallels
  - 工作日常
description: 真实踩坑记录：USB拓展坞带宽和供电不足导致的固态硬盘降速/罢工问题
---

## 写在开头

最近遇到了一个奇怪的问题：新买的金士顿 NVMe 固态硬盘，标称读写速度 2000MB/s，结果在我的 Mac 上用 USB 拓展坞连接后，速度只能跑到几百 MB/s，还经常掉盘。排查了半天，发现是拓展坞的锅。
