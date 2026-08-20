# 数据库与内容基础 PRD

## 目标

建立后续全部内容 API 与管理 UI 依赖的可靠数据基础：可审阅 migration、显式数据源、稳定 repository ports、local/Neon adapters、共享解码与安全导入 CLI。

## 需求

- 将已评审 schema 提升为版本化 migration，但不执行真实远程数据库。
- 新增 `BLOG_CONTENT_SOURCE=local|neon`；production 只允许 Neon，失败不得自动 fallback。
- 保持现有页面领域 DTO，抽取 local 与 Neon 都实现的读取契约。
- 为 site、文章、taxonomy、归档、搜索、统计和侧栏实现参数化 Neon 查询与 row decoder。
- 集中拥有 JSON/date/null/slug 映射、ContentBlock 校验和派生逻辑。
- 建立最小 TypeScript 测试运行器与 repository contract tests。
- 提供 `content:import`：默认 dry-run，`--apply` 单事务写入，已有文章时拒绝，不覆盖 owner。

## 验收标准

- [ ] AC1：production 无法选择 local，Neon 错误不会被本地内容掩盖。
- [ ] AC2：现有 local repository 行为和 DTO 不退化。
- [ ] AC3：Neon adapter 覆盖全部展示读取能力，SQL 参数化且 row 在返回领域层前完成校验。
- [ ] AC4：local/Neon fixture contract tests 覆盖排序、null、404 与合法空 taxonomy。
- [ ] AC5：migration verification 覆盖单账号、状态、slug、version、public view 和审计约束。
- [ ] AC6：import 默认不写；`--apply` 只对空内容库原子写入，失败无部分数据，重复执行安全拒绝。
- [ ] AC7：`pnpm test`、lint、typecheck 和 build 通过。

## 不在范围

- 不实现 HTTP Route Handlers、管理页面或文章编辑器。
- 不执行真实 Neon migration/import，不修改生产 Secret。

## 依赖

- 继承父任务 `08-19-blog-api-ui-completion` 的 `prd.md` 与 `design.md`。
- 复用 `08-18-neon-api-database-docs` 的 API/schema/Neon research。
