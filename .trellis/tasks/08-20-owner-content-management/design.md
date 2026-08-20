# 修正内容归属与站长文章管理：技术设计

## 目标边界

本次修改分成四条边界：

1. **Empty state**：Neon 内容表缺失或为空时，repository 返回合法 DTO；页面显示真实 owner 临时资料和空状态，不再因 `site_settings` 缺行抛 500。
2. **Owner read/write**：所有管理读取和更新都从 session 得到 `accountId`，在 SQL 的 `owner_id` 条件中完成隔离；页面不直接读取 server-only repository。
3. **Structured editor**：编辑页以共享 `ContentBlock` schema 为唯一契约，用 reducer 管理 block 列表，预览复用纯 renderer；PATCH 使用 `version` 乐观并发。
4. **Cleanup**：提供仅针对 `local-import` audit source 的事务 SQL，删除演示内容和孤立 taxonomy，并将 profile/site 回到真实 owner 来源。

## 数据流

```text
session cookie
  → requireCurrentSession() / requireApiSession()
  → accountId
  → owner repository SQL (owner_id = accountId)
  → OwnerPost DTO + version
  → account server page / editor client
  → PATCH JSON + version
  → parseApiInput(ContentBlock/schema)
  → owner update transaction + post_audit_events
  → refreshed OwnerPost DTO
```

## Empty content 与真实作者

- Neon site query 改为从唯一 `owner_accounts` 出发，`site_settings` 与 `author_profiles` 使用 `LEFT JOIN`；没有配置行时使用稳定默认站点外观和 `owner.email` 的本地部分作为临时 author name。
- `decodeSiteConfig` 保持对非空数据库行的严格校验；fallback 只在配置缺行时生成，不把本地 `content/site.ts` 的“林屿”带入 Neon。
- taxonomy、posts、archive、search、sidebar 都以空数组和 0 统计表示无内容；页面使用 `EmptyState`，不伪造文章。
- cleanup SQL 删除导入的 site row，并把 profile name 设置为 owner email local-part；之后 owner 可以通过 profile 管理接口继续自定义（本任务优先保证首页真实来源）。

## Owner 内容契约

新增 `OwnerPost` / `OwnerPostSummary` 领域类型，字段覆盖：

- `id`, `ownerId`, `version`, `status`, `deletedAt`
- `slug`, `title`, `excerpt`, `category`, `tags`, `cover`, `featured`
- `body`, `publishedAt`, `updatedAt`

Published public DTO 继续使用现有 `PostSummary`/`PostDetail`，避免改变公开页面和 read API 契约。

Owner repository 新增：

- `listOwnerPosts(accountId, filters)`：按 owner、状态、更新时间/发布时间排序，支持 published/draft/archived/deleted 过滤。
- `getOwnerPostById(accountId, id)`：返回完整可编辑 block 和 version。
- `updateOwnerPost(accountId, id, expectedVersion, input, requestId)`：在一个短事务内执行 owner/version 条件更新和一条 audit event。

更新 SQL 不接受客户端 `owner_id`、`status`、`published_at` 或 `slug` 覆盖；已发布文章 slug 保持不可变。公开字段更新后保留发布状态，`content_updated_at` 只在已发布文章实际内容更新时变化。

## API 边界

- `GET /api/v1/me/posts?status=published|draft|archived|all`：当前 owner 列表，返回 cursor page。
- `GET /api/v1/me/posts/[id]`：当前 owner 文章详情。
- `PATCH /api/v1/me/posts/[id]`：携带 `version` 更新 metadata、taxonomy、cover、featured 和 `ContentBlock[]`；返回更新后的 DTO。
- 所有 mutation 顺序：request id → same-origin → session → input schema → owner service；冲突返回 `409 VERSION_CONFLICT`。
- 每次成功更新在同一事务插入 `post_audit_events(action='update')`，changes 只记录版本和字段摘要，不记录正文/Secret。

## Editor UI

- `/account` Server Component 读取当前 owner 统计和已发布文章，渲染编辑入口及空状态。
- `/account/posts/[id]/edit` Server Component 首次读取 owner post；`PostEditor` Client Component 用 reducer 管理 `editorDraft`、server snapshot、dirty、saving、conflict。
- block editor 逐项支持 heading、paragraph（text/link/code inline）、list、quote、image、code；提供新增、上移、下移、复制、删除。
- editor preview 复用一个不依赖 server-only 的 `ContentBlock` renderer；保存成功用服务器 DTO 更新 snapshot，409 保留本地 draft 并提示用户。
- 图片字段先支持现有本地/R2 URL 结构；不在本任务新增上传协议。

## Cleanup SQL 设计

SQL 使用 `BEGIN`/`COMMIT` 和临时表锁定目标集合：

1. 只选唯一 owner 下有 `post_audit_events.changes->>'source' = 'local-import'` 且 action=create 的文章。
2. 删除这些文章的 post_tags、audit rows、posts；不使用无条件 `TRUNCATE`。
3. 仅删除指定演示 taxonomy 中没有其他引用的行。
4. 删除演示 singleton site row，并将 owner profile 的 name 从 owner email 派生；不触碰 owner/password/session。

## 兼容性与回滚

- 不修改 baseline schema；复用现有 owner/version/audit 约束。
- API 新增路径，不改变公开 read API。
- UI 路由可独立回退；已保存文章不做代码回滚覆盖。
- cleanup SQL 在执行前必须先 `SELECT` 预览目标集合；执行后可通过 owner/public queries 验证 counts。
