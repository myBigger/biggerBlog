---
author: 必哥
pubDatetime: 2026-03-28T00:00:00.000Z
title: Qt Windows 平台引入 OpenSSL 踩坑记录
slug: qt-windows-openssl-pitfalls
featured: false
draft: false
tags:
  - Qt
  - OpenSSL
  - Windows
  - 踩坑记录
  - 教程
description: 记录在 Windows 平台开发 Qt 程序时遇到 OpenSSL 相关问题的解决过程，引用帮助很大的博客。
---

## 写在开头

之前在 Windows 平台开发 Qt 程序，需要用到 HTTPS 请求，结果遇到了 OpenSSL 相关的问题。搜了一圈，发现网上很多文章都讲得不清不楚，直到找到这篇博客才算真正解决问题。

虽然这篇文章主要是引用整理，但这类问题确实坑过不少人，分享出来希望能帮到更多同行。

## 问题描述

主要遇到以下问题：
- 运行报错 `TLS initialization failed`
- OpenSSL 版本不匹配
- 部署时缺少 DLL 文件
- MinGW 和 MSVC 编译版本混用问题

## 解决方案参考

多亏这篇博客的帮助，问题顺利解决：

👉 [Qt项目实战：如何快速解决OpenSSL版本不匹配导致的HTTPS访问失败问题](https://blog.csdn.net/docker8compose/article/details/150570100)

这篇文章把常见的坑都讲清楚了，包括：
1. DLL 文件放哪里（.exe 同级目录、系统 PATH、Qt bin 目录）
2. 版本怎么匹配（Qt 编译时用的 OpenSSL 版本 vs 运行时版本）
3. .pro 文件怎么配置
4. MinGW 和 MSVC 的区别（千万不能混用！）

## 常见问题汇总

### 1. OpenSSL 库未安装或路径未配置

Qt 应用程序在需要使用 HTTPS 等加密功能时，依赖 OpenSSL 库。如果系统没有安装 OpenSSL，或者 Qt 无法在预期的路径找到这些库文件（如 `libssl-1_1-x64.dll` 和 `libcrypto-1_1-x64.dll`），就会报错：`qt.network.ssl: QSslSocket::connectToHostEncrypted: TLS initialization failed`

**解决方法：**
- 下载并安装 OpenSSL（建议从官方推荐的预编译版本下载）
- 将 DLL 文件拷贝到应用程序的 .exe 同级目录、系统 PATH 目录、或 Qt 安装目录下的 bin 文件夹

### 2. OpenSSL 版本不匹配

Qt 在编译时会链接特定版本的 OpenSSL。如果在运行时加载的 OpenSSL 库版本与 Qt 编译时所使用的版本不一致，也可能导致 SSL 握手失败。

**解决方法：**
- 使用 `QSslSocket::sslLibraryBuildVersionString()` 查看 Qt 编译时使用的 OpenSSL 版本
- 使用 `QSslSocket::sslLibraryVersionString()` 显示运行时加载的 OpenSSL 版本
- 确保安装的版本与 Qt 编译版本一致

### 3. 部署时缺少 OpenSSL 库

当 Qt 应用程序独立部署到其他机器时，OpenSSL 的 DLL 文件也需要一同部署。

### 4. MinGW 与 MSVC 编译版本

如果使用 MinGW 编译 Qt 应用程序，确保 OpenSSL 库也是用 MinGW 编译的版本，而不是 MSVC 编译的版本。

## 总结

如果你也在 Windows 上用 Qt 开发需要用到 HTTPS，强烈建议先看看这篇文章，少走很多弯路。

---

 🙏 感谢阅读！
🌍 Thanks! · Merci · Gracias · Danke · Arigato · Shukran
