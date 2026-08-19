# Neon 与现有内容契约核对记录

## 核对日期

2026-08-18

## Neon 官方结论

1. [Connect from any application](https://neon.com/docs/connect/connect-from-any-app)
   - 连接串应通过服务端环境变量提供，不能硬编码或进入客户端 bundle。
   - Neon 同时提供 pooled 与 direct connection string。
2. [Connection pooling](https://neon.com/docs/connect/connection-pooling)
   - Web/API 运行时优先使用 hostname 带 `-pooler` 的连接串。
   - Neon PgBouncer 使用 transaction mode；应用不能依赖跨事务 session 状态。
   - migration、`pg_dump`、`pg_restore` 等管理操作使用 direct connection。
3. [Neon serverless driver](https://neon.com/docs/serverless/serverless-driver)
   - HTTP 查询适合 one-shot query 与 non-interactive transaction。
   - `Pool`/`Client` 面向需要 WebSocket 或交互事务的场景，不应为当前简单读写默认增加 session 复杂度。
4. [Neon Auth overview](https://neon.com/docs/auth/overview)
   - Neon Managed Better Auth 是独立托管能力；本项目用户已明确选择自研认证，不采用该能力。

## 当前代码契约

- `lib/content/types.ts` 定义 `SiteConfig`、`PostSummary`、`PostDetail`、`TaxonomySummary`、`ArchiveYearGroup`、`SearchDocument`、`SiteStats` 与 `ContentBlock`。
- `lib/content/repository.ts` 暴露 site、文章列表/详情、recent、归档、标签/分类列表和详情、搜索索引、stats、sidebar 的异步只读入口。
- 文章默认按发布日期降序；taxonomy 按 count 降序再按中文名称稳定排序；未知 taxonomy 返回 `null`，合法空 taxonomy 返回空数组。
- `lib/content/derive.ts` 从 blocks 派生 word count、reading minutes、TOC、previous/next、archive groups 与 taxonomy count。
- `lib/content/search.ts` 使用 NFKC/trim/lower，并按标题 3、taxonomy 2、摘要 1 排序。
- post/tag/category 动态页当前使用 `dynamicParams = false`；接入运行时发布后必须允许动态 slug，否则新内容需要 rebuild 才能访问。

## 对方案的直接约束

- 页面继续消费领域 repository，不直接消费数据库行，也不通过本项目 HTTP API 绕行。
- runtime 使用 `DATABASE_URL` pooled；baseline、bootstrap、reset-password 使用 `DATABASE_URL_UNPOOLED` direct。
- SQL 使用 `blog.*` 全限定名，不依赖 `SET search_path`、session advisory lock、`LISTEN/NOTIFY` 或跨事务临时表。
- 公开查询必须集中执行 `published AND not deleted` 可见性规则，并保持未知/合法空 taxonomy 区别。
- word count、reading time、TOC、archive、count 和 search projection 继续派生，避免写入第二份事实。
- 单账号由数据库 singleton unique 约束，不设计注册、角色或多作者隔离。

## 当前验证边界

- 本任务未连接真实 Neon、未读取 Secret、未执行远程 SQL。
- 当前机器没有 `psql` 或 SQL parser；`schema.sql` 仅完成结构、括号、语句边界和文档一致性静态检查。
- 实际 PostgreSQL 执行必须在后续获批实施阶段使用 disposable local database 或隔离 Neon branch 验证。
