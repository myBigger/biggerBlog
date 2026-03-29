---
author: 必哥
pubDatetime: 2026-03-26T00:00:00.000Z
title: IDEA 中使用 Claude + Minimax 模型配置教程
slug: claude-agent-minimax-config
featured: false
draft: false
tags:
  - IDEA
  - AI
  - Claude
  - Minimax
  - 教程
description: 记录在 IDEA 中使用 Claude Agent 插件配合 CC-Switch 连接国内大模型的配置过程和使用体验。
---

## 写在开头

之前在 IDEA 里用 AI 辅助编程，要么得翻墙，要么体验不好。最近发现 **Claude Agent** 插件配合 **CC-Switch** 可以直接用国内大模型，体验还不错。记录一下配置过程，供大家参考。

## 准备工作

在开始配置之前，你需要准备以下内容：

1. **IDEA** - JetBrains 家的 IDE（IntelliJ IDEA、WebStorm 等都可以）
2. **API Key** - 国内大模型的 API Key，支持以下平台：
   - Minimax
   - Deepseek
   - 阿里云百炼
   - Kimi

## 安装 Claude Agent 插件

1. 打开 IDEA → `Settings` → `Plugins`
2. 点击 `Marketplace`，搜索 `Claude Agent`
3. 安装并重启 IDEA

## 配置 CC-Switch

Claude 本身不支持中国区登录，这时候就需要 **CC-Switch** 来切换大模型。

**CC-Switch** 支持 macOS 和 Windows 系统，可以帮助 Claude Agent 连接国内大模型。

具体配置步骤可以参考 CC-Switch 官方文档。

## 使用体验

用了一段时间后，感受最深的几点：

### 1. 代码识别能力强

Claude Agent 能直接识别当前 IDEA 正在打开的代码文件，不需要手动复制粘贴。

### 2. 错误处理方便

遇到编译出错或者不认识的代码时，直接把报错信息发给 AI，或者直接对话提问即可。

### 3. 直接帮你改代码

最实用的一点：**AI 会直接帮你修改代码**，然后询问你是否同意替换。这比网页版方便太多了！

### 4. 效率提升明显

- 不用来回切换网页版
- 提问更精准（上下文自动带入）
- 修改直接应用，省时省力

## 总结

如果你也是在国内开发，又想在 IDE 里用上 AI 编程，强烈推荐试试这个组合。配置简单，效果立竿见影。

---

🙏 感谢阅读！
🌍 Thanks! · Merci · Gracias · Danke · Arigato · Shukran