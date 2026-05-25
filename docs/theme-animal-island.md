# 动森风格主题（theme/animal-island）

视觉参考 [animal-island-ui](https://guokaigdg.github.io/animal-island-ui/#/)，实现为 Astro + 纯 CSS，未引入 React 组件库。

## 设计决策

- **克制**：纯色奶油背景，无强渐变装饰
- **卡片**：NookPhone 多色交替（`Card.astro` 的 `colorIndex`）
- **双主题**：浅色「白天岛屿」+ 暗色「夜晚岛屿」
- **字体**：Google Fonts — Nunito、Noto Sans SC、Zen Maru Gothic

## 关键文件

| 文件 | 作用 |
|------|------|
| `src/styles/animal-island.css` | 色板、`.ac-card`、`.ac-btn` 等 utility |
| `src/styles/global.css` | CSS 变量与 Tailwind 主题映射 |
| `src/layouts/Layout.astro` | 字体 `<link>` |

## 回滚

不 merge 此分支即可保持 `main` 原样；或关闭 PR 后删除 `theme/animal-island`。
