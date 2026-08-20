# 数据库与内容基础设计

## 边界

本子任务实现父设计第 4、5、9 节，不改变页面和 HTTP 路由。

## 模块

- `lib/content/repository.ts`：兼容 facade，只依赖 selector/port。
- `lib/content/local-repository.ts`：当前本地实现迁移后的位置。
- `lib/content/neon-repository.ts`：参数化读取和 row mapping。
- `lib/content/contracts.ts`：repository interface、page/cursor input。
- `lib/content/schemas.ts`：数据库 JSON 和 DTO 边界 schema。
- `lib/content/source.ts`：`BLOG_CONTENT_SOURCE` fail-fast selector。
- `db/migrations/*`、`db/tests/*`：schema 与 contract verification。
- `scripts/import-local-content.mjs` 或类型安全等价入口：direct connection 导入。

共享派生继续使用现有 `derive.ts`/`search.ts`；先搜索再移动，禁止复制算法。

## 测试替身

Neon repository 通过窄 query executor port 注入测试 rows；单元/契约测试不得要求真实网络。真正 SQL schema/integration 只在 disposable PostgreSQL 或另行批准的隔离 Neon 执行。

## 回滚

保持 selector 为显式 local 可恢复开发验证；production guard 不允许以 local 作为生产回滚。
