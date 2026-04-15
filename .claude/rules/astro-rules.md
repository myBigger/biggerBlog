# AstroPaper 项目规范

> 本规则定义 biggerBlog 仓库的 Astro / TypeScript 开发规范。
> 适用场景：修改配置、写新组件、改动页面结构。

---

## 一、项目技术栈

```
Astro 5.x        — 静态站点框架
TypeScript       — 类型系统
Tailwind CSS v4  — 通过 @tailwindcss/vite 插件集成
Shiki            — 代码高亮（已配置 min-light / night-owl 主题）
pnpm             — 包管理器
```

---

## 二、目录结构

```
src/
├── config.ts            ← 全局站点配置（SITE 对象）
├── constants.ts         ← 常量定义
├── content.config.ts    ← Astro 内容集合配置
├── data/
│   └── blog/            ← 所有博客文章（.md 文件）
├── assets/              ← 静态图片资源
├── components/           ← Astro / React 组件
├── layouts/             ← 页面布局组件
├── pages/               ← 路由页面
├── remark-plugins/      ← 自定义 remark 插件
├── scripts/             ← 构建脚本
├── styles/              ← 全局样式
└── utils/               ← 工具函数
```

---

## 三、Config.ts 说明

**不要直接修改 `src/config.ts`**，除非改动涉及站点元信息。如果需要改：
- 站点标题 → `SITE.title`
- 作者 → `SITE.author`
- 描述 → `SITE.desc`
- 时区 → `SITE.timezone`（已设置为 Asia/Shanghai）

---

## 四、内容（Frontmatter）规范

参考根目录 CLAUDE.md 第五节「Frontmatter 规范」。

**特别注意**：
- `pubDatetime` 必须是 ISO 8601 UTC 时间字符串（`2026-04-15T00:00:00Z`），不得用本地时间
- `slug` 字段控制 URL，修改后旧的 URL 会 404，请同步更新
- `draft: true` 的文章不参与构建，也不会出现在 sitemap

---

## 五、CI/CD 检查项

每次 push 触发的工作流包含三个检查：

```bash
pnpm run lint      # ESLint 检查（TypeScript + Astro）
pnpm run format:check  # Prettier 格式检查
pnpm run build     # Astro 构建（失败则 Vercel 不部署）
```

**修改代码后**，运行这三项确认通过再 push：
```bash
pnpm run lint && pnpm run format:check && pnpm run build
```

---

## 六、常见修改指引

### 新增博客文章

1. 在 `src/data/blog/` 创建 `{slug}.md` 文件
2. 遵循 AstroPaper frontmatter schema（必须有 `title`、`pubDatetime`、`description`）
3. 草稿阶段设 `draft: true`，确认无误后改为 `false`
4. push 后 Vercel 自动检测并发布

### 修改样式

- 全局样式 → `src/styles/global.css`
- 组件样式优先用 Tailwind CSS class，不另起 CSS 文件
- 深色模式：AstroPaper 原生支持，按 `html.dark` 写条件样式

### 添加新页面

- 新建 `src/pages/{slug}.astro`
- 布局使用 `src/layouts/` 中的现有布局组件
- 参考 `src/pages/index.astro` 了解数据获取方式

---

## 七、构建与本地预览

```bash
pnpm install           # 安装依赖
pnpm run dev           # 本地开发预览（热更新）
pnpm run build         # 生产构建
pnpm run preview       # 预览构建产物
```

**注意**：依赖通过 `pnpm-lock.yaml` 锁定，修改 `package.json` 后必须重新 `pnpm install` 并 commit lock 文件。
