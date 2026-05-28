# biggerBlog 仓库概览

> 供新协作者或 AI 快速了解本仓库。详细约定见 [CLAUDE.md](../CLAUDE.md)。

## 项目定位

| 项 | 值 |
| --- | --- |
| 名称 | 必哥的技术笔记（biggerBlog） |
| 线上地址 | https://biggerblog.vercel.app/ |
| 基础模板 | [AstroPaper](https://github.com/satnaing/astro-paper) v5.5.1 |
| 技术栈 | Astro 5 + TypeScript + Tailwind CSS 4 + Pagefind |
| 受众 | 有实战经验的中文工程师 |

核心定位：**记录真实踩坑与实践经验**；专栏「必哥手记」有固定写作体例（见 [.claude/rules/blog-writing.md](../.claude/rules/blog-writing.md)）。

## 目录结构

| 路径 | 作用 |
| --- | --- |
| `src/config.ts` | 站点标题、域名、分页、语言 `zh-CN`、时区 |
| `src/data/blog/` | 全部 Markdown 博文 |
| `src/content.config.ts` | 内容集合与 Zod schema |
| `src/pages/` | 路由：首页、文章、标签、归档、搜索、RSS、OG |
| `src/styles/global.css` | 主题变量与 Tailwind |
| `src/styles/animal-island.css` | 动森风 UI（见 [theme-animal-island.md](./theme-animal-island.md)） |
| `CLAUDE.md` | AI 协作与写作规范 |
| `.github/workflows/ci.yml` | PR：lint → format:check → build |

## 文章 URL

路径由 [src/utils/getPath.ts](../src/utils/getPath.ts) 生成：`/posts/{slug}`。

- `slug` 取自 frontmatter 的 `slug:` 字段（必填）；未填时回退为文件名（不含 `.md`）。
- 文件名建议与 `slug` 一致；仅在需要稳定 URL 且改名文件时使用不同 `slug`（例如 `qtauthnet-rethink.md` → `slug: qtauthnet-design-mistakes`）。

## 现有内容（按系列）

**必哥手记（Qt/网络）**

- `qt-network-truth.md` — 第 1 期
- `qtauthnet-design.md` — 第 2 期
- `qt-network-advances.md` — 第 3 期
- `qtauthnet-rethink.md` — Qt 网络库设计误区

**QtAuthNet 开源系列**

- `qtauthnet-00-index.md` — 目录索引（slug: `qtauthnet-index`）
- `qtauthnet-01-origin.md` … `qtauthnet-07-design.md`

**后端踩坑手记（Wiki 迁移 P0）**

- `backend-pitfalls-01-mybatis-null.md`
- `backend-pitfalls-02-bpm-assignee.md`
- `backend-pitfalls-03-snapshot-bpm.md`

发布备忘见 [wiki-migration-backlog.md](./wiki-migration-backlog.md)。

## 本地开发

```bash
pnpm install
pnpm run dev      # http://localhost:4321
pnpm run build    # astro check + build + pagefind
pnpm run lint
pnpm run format:check
```

`draft: true` 的文章不会进入构建产物。push `main` 经 CI 后由 Vercel 部署。

## 常见任务

| 任务 | 主要位置 |
| --- | --- |
| 新写文章 | `src/data/blog/{name}.md` + frontmatter |
| 改站点信息 | `src/config.ts` |
| 改首页/布局 | `src/pages/index.astro`、`src/layouts/`、`src/components/` |
| 改主题 | `src/styles/animal-island.css`、`global.css` |

分支命名：`article/`、`fix/`、`feature/`。默认不升级核心依赖、不删已有文章。
