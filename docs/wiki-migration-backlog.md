# Wiki → 博客迁移 Backlog

> 写作细则：[blog-style-guide.md](./blog-style-guide.md)  
> 仓库：`src/data/blog/*.md`

## P0（已完成）

| 期 | 标题 | slug | 状态 |
|----|------|------|------|
| 1 | MyBatis-Plus 为什么写不进 NULL | `backend-pitfalls-01-mybatis-null` | [x] |
| 2 | 为什么 BPM 下一节点办理人总是空？ | `backend-pitfalls-02-bpm-assignee` | [x] M2 修订终极版 |
| 3 | 审批单为什么要「主表+明细+JSON 快照」？ | `backend-pitfalls-03-snapshot-bpm` | [x] |

## M1（2026-05）

| 序 | 系列 | 标题 | slug | 状态 |
|----|------|------|------|------|
| ① | 工具链 | pnpm 指向 /tmp，Vercel 装不上依赖 | `devtools-vercel-pnpm-overrides` | [ ] |
| ② | 后端踩坑 | 第 4 期 · 待办进详情为什么要带 taskId | `backend-pitfalls-04-bpm-taskid` | [ ] |
| ③ | 亲子手记 | 第 1 期 · 给女儿做一座 3D 工程岛 | `qinzin-01-dig-island` | [ ] |

## P1 后端踩坑（排队）

| 期 | 标题 | Wiki 源 | slug 预留 |
|----|------|---------|-----------|
| 5 | 首节点自动跳过与 bizStatus | `20-postmortems/2026-05-09-scjy10k-first-node-auto-skip-and-return.md` | `backend-pitfalls-05-first-node-skip` |
| 6 | LocalDate JSON 变 1970 | `10-runbooks/java-localdate-json-vue-datepicker.md` | `backend-pitfalls-06-localdate-1970` |
| 7 | 驳回后流程实例 ID 僵尸单 | `20-postmortems/2026-05-13-scjy09k-draft-stale-process-instance-id.md` | `backend-pitfalls-07-stale-process-id` |

**已取消**：独立「第 4 期 数据权限深化」→ 合并进第 2 期修订（M2）。

## 脱敏自检（每篇发布前）

- [ ] 无真实单位名 / 部门专名 / 表单业务编号
- [ ] 无内网 IP、未公开仓库 URL（GitHub 公开项目链接除外）
- [ ] 无 funciot、罪犯、狱政、9100 BFF 等 Wiki 专词
- [ ] log/SQL 中用户名、单号已替换
- [ ] 代码为通用类名

## 发布备忘

- [ ] M1 三篇 `draft: false` 并 push
- [ ] 后端系列 index：`backend-pitfalls-00-index.md`
- [ ] 桌面端 index：`desktop-hand-00-index.md`（M2 起）
- [ ] 第 1 期 `featured: true`（可选）
- [ ] M2：修订 `backend-pitfalls-02-bpm-assignee.md`（文首灰字）
