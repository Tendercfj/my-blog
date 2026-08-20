# 修正内容归属与站长文章管理：实施计划

## Phase 1：清理与 empty state

1. 添加并评审 cleanup SQL（只提供 SQL 文件/文档，不在实现阶段自动执行生产 destructive query）。
2. 修改 Neon site/profile row decoder 与 fallback，覆盖无 site/profile、无 taxonomy、无 posts。
3. 修改 page empty states、PostGrid/sidebar/archive/category/tag/search 的 0 内容分支。
4. 增加 repository/service tests：空 site、空 snapshot、真实 owner author、published-only public read。

## Phase 2：owner repository/service/API

5. 定义 OwnerPost DTO、input schema 和 ContentBlock update schema，复用现有 zod validators。
6. 实现 owner-bound SQL 查询和 update transaction；加入 owner 404、version conflict、slug immutability、audit 摘要测试。
7. 实现 `/api/v1/me/posts`、`/api/v1/me/posts/[id]` GET/PATCH，接入 request/origin/session/error envelope。
8. 增加 API tests：未认证、异源、跨 owner、空列表、published update、invalid block、409。

## Phase 3：站长工作区与完整 editor

9. 将 `/account` 占位页改为真实 owner profile、统计和 published article list；提供空状态和编辑入口。
10. 新增 `/account/posts/[id]/edit` 与 `PostEditor`，以 reducer 实现 block 增删改、排序、复制、删除、预览和 dirty/conflict 状态。
11. 新增 block-specific editor components，保持 390px 移动布局、键盘 focus 和可访问标签。
12. 浏览器验证空内容首页、真实作者、账号列表、已发布文章编辑保存与刷新闭环。

## Validation

```bash
pnpm test
pnpm lint
pnpm exec tsc --noEmit
pnpm exec next build --webpack
git diff --check
```

真实 Neon cleanup SQL 仅在用户明确授权后执行；代码测试不依赖真实 Neon。生产验证重点检查 owner/session 未变、文章 owner_id 正确、更新后公开首页与 account 列表一致。

## 风险与回滚点

- fallback site config 若遗漏字段会在 metadata/layout 触发异常；先锁定 decoder fixture 再接页面。
- PATCH 事务只允许 owner+version 命中；任何零行更新必须区分 404 与冲突。
- 编辑器不自动保存、不隐式覆盖冲突；移除编辑 UI 不影响已保存内容。
- cleanup SQL 执行前后保留 counts 和 owner identity 查询结果；不删除非导入内容。
