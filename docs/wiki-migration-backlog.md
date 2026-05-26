# Wiki → 博客迁移 Backlog（P0）

> 系列：**后端踩坑手记** · 仓库：`src/data/blog/backend-pitfalls-*.md`

## P0 试点（当前阶段）

| 期 | 标题 | slug | 状态 | draft |
|----|------|------|------|-------|
| 1 | MyBatis-Plus 为什么写不进 NULL | `backend-pitfalls-01-mybatis-null` | [x] 已写 | true |
| 2 | 为什么 BPM 下一节点办理人总是空？ | `backend-pitfalls-02-bpm-assignee` | [x] 已写 | true |
| 3 | 审批单为什么要「主表+明细+JSON 快照」？ | `backend-pitfalls-03-snapshot-bpm` | [x] 已写 | true |

## 脱敏自检（每篇发布前勾选）

- [ ] 无真实单位名 / 部门专名 / 表单业务编号
- [ ] 无内网 IP、域名、未公开仓库 URL
- [ ] 无 funciot、罪犯、狱政、9100 BFF 等 Wiki 专词
- [ ] log/SQL 中用户名、单号、IP 已替换
- [ ] 代码为通用类名（`BizRecordServiceImpl` 等）

## 发布备忘

- [ ] 第 1 期：`draft: false`，`pubDatetime = D0`
- [ ] 约 7 天后：第 1 期 `featured: true`
- [ ] 第 2/3 期：`D0+7` / `D0+14`
- [ ] `theme/animal-island` merge 后：首页 hero 连载行
- [ ] P1 ≥ 5 篇：系列 index + 移除 hero 行

## P1+（待 P0 审过后启动）

见计划文档 `wiki_迁移博客计划_eb7f6f8c.plan.md`。
