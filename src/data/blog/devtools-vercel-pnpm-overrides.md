---
author: 必哥
pubDatetime: 2026-05-28T08:00:00.000Z
title: "「工具链」| 第 1 期 · pnpm 指向 /tmp，Vercel 为什么装不上依赖"
slug: devtools-vercel-pnpm-overrides
featured: true
draft: false
tags:
  - 工具链
  - Vercel
  - pnpm
  - Astro
description: 部署在 Installing dependencies 就挂？pnpm overrides 写成本机 /tmp 路径，换机器必炸——复盘与修复。
---

> 「工具链」| 第 1 期

---

## 翻车现场

push 到 `main` 之后，GitHub 上 Vercel 的检查是红的。点进 Deployment，构建日志停在：

```text
ENOENT: no such file or directory, open '/tmp/strnum-patch/strnum-2.1.1.tgz'
pnpm install
Error: Command "pnpm install" exited with 254
```

本地 `pnpm run dev` 一切正常。我第一反应是「Vercel 又抽风了」，直到把日志和 `package.json` 对在一起——**问题在我自己的仓库里**。

## 根因：overrides 不是「补丁」，是「绝对路径」

当时在本地为了解决某个传递依赖的版本冲突，我在 `package.json` 里加了 `pnpm.overrides`，把包装成本机临时目录里的 `.tgz`：

```json
{
  "pnpm": {
    "overrides": {
      "strnum": "file:/tmp/strnum-patch/strnum-2.1.1.tgz",
      "stream-replace-string": "file:/tmp/pnpm-patches/stream-replace-string-2.0.0/stream-replace-string-2.0.0.tgz"
    }
  }
}
```

`pnpm-lock.yaml` 里也会锁死这些 `file:` 路径。在我电脑上 `/tmp/strnum-patch/` 确实存在，所以 `pnpm install` 能过。

Vercel 的构建机是干净的 Ubuntu。**没有**我机器上的 `/tmp/strnum-patch/`。pnpm 按 lockfile 去 fopen 那个路径，直接 ENOENT——连 `astro build` 都还没跑到。

这类坑的共性：**把「只在当前开发者机器上成立」的路径写进了版本库**。

## 怎么修

### 1. 删掉 overrides，回到 registry

```json
// ❌ 提交到 Git 的写法
"pnpm": {
  "overrides": {
    "strnum": "file:/tmp/strnum-patch/strnum-2.1.1.tgz"
  }
}

// ✅ 删掉整个 pnpm 块，或改用 npm 上真实版本号
```

### 2. 在本机重新生成 lockfile

```bash
rm -rf node_modules
pnpm install
pnpm run build
```

确认 `pnpm-lock.yaml` 里不再出现 `/tmp/` 或 `file:../../../../../tmp`。

### 3. 再 push，看 Vercel 的 Install 阶段

修复后同一提交在 Vercel 上应能完整跑完 `pnpm install` → `pnpm run build`（本博客还有 `pagefind` 步骤）。

若你**必须**打补丁，把 `.tgz` 放进仓库，例如 `patches/strnum-2.1.1.tgz`，overrides 写相对路径：

```json
"strnum": "file:./patches/strnum-2.1.1.tgz"
```

并提交 patch 文件。CI、Vercel、同事电脑才能一致。

## 预防：三条习惯

1. **永远不要把 `/tmp`、`/Users/xxx` 写进 lockfile。** Code review 时搜一眼 `file:/`。
2. **PR 里让 CI 跑 `pnpm install`，与 Vercel 同源。** 本博客用 GitHub Actions：`lint` → `format:check` → `build`。
3. **本地能装 ≠ 能部署。** 发版前用全新目录 `git clone` 测一次 install。

## 协作方式：我和 Cursor 怎么写完这篇复盘

这篇不是「AI 代写鸡汤」，而是真实事故记录，分工大致如下：

| 环节 | 我 | Cursor / Claude |
|------|----|-----------------|
| 现象 | 看 Vercel 日志、对照 GitHub Deployment | 帮拉 `vercel inspect` 日志摘要 |
| 根因 | 想起本地 overrides 来源 | 在仓库里 grep `/tmp/`、解释 lockfile 机制 |
| 修复 | 删 overrides、`pnpm install`、push | 改 `package.json`、检查 lockfile diff |
| 成文 | 定「工具链」系列语气、要不要写 AI | 按 [blog-style-guide](../../docs/blog-style-guide.md) 起稿，我删废话 |

我保留「哪里会再踩」的判断；AI 擅长把命令和 JSON 片段排版整齐。**最终发布前仍是我自己通读 + `pnpm run build`。**

## 延伸

- 若你用 `npm ci` 而仓库里主要是 `pnpm-lock.yaml`，Vercel 会按 lock 检测用 pnpm——**锁文件与平台要一致**。
- Astro 博客构建链：`astro check && astro build && pagefind`；install 挂了后面都谈不上。

**教训**：overrides 是全局契约，别写成「只有我的 Mac 懂的路径」。

---

**系列**：工具链 · 第 1 期 · 下一篇计划写 AstroPaper 定制与 Pagefind（排队中）。
