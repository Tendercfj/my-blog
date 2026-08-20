# 修正内容归属与站长文章管理

## Goal

让内容为空的 Neon 数据库仍能正常渲染博客；让唯一站长账号成为站点作者和文章 owner 的唯一事实来源；让 `/account` 能查看自己已发布的文章并安全修改；清理刚才导入的演示内容时不影响 owner、密码和 session。

## Confirmed Facts

- 当前数据库只有 `blog.owner_accounts` 与认证相关数据，内容数据曾由 `scripts/import-local-content.mjs` 导入。
- 导入脚本把本地演示作者“林屿”、站点配置、分类、标签和 6 篇文章写入 Neon；文章 `owner_id` 指向唯一 owner，但作者资料内容不是登录账号的真实资料。
- `lib/content/neon-repository.ts` 的 `getSiteConfig()` 在没有站点配置行时抛出异常，导致内容为空时页面 500。
- `app/(protected)/account/page.tsx` 目前只显示邮箱和占位文案，没有文章列表或编辑入口。
- `/api/v1/posts` 及其详情路由只读已发布公共内容，所有写方法当前返回 `METHOD_NOT_ALLOWED`。
- 数据库 schema 已有 `owner_id`、`version`、draft/published/archived 状态、软删除字段和文章审计表，可用于 owner-bound 乐观并发写入。

## Requirements

### R1. 清理演示内容

- 提供一条带事务、owner 和 `changes->>'source' = 'local-import'` 约束的 SQL，删除刚才导入的文章、关联、审计记录及孤立演示 taxonomy。
- SQL 不得删除 `owner_accounts`、`auth_sessions`、密码、登录限流或用户已有的非导入内容。
- 清理后，作者资料和站点显示信息应来自真实 owner/profile，不再保留“林屿”演示身份。

### R2. 空内容可用

- Neon repository 在没有 `site_settings`、`author_profiles`、分类、标签或文章时返回合法空状态 DTO，不抛 500。
- 首页、侧栏、归档、分类、标签、搜索和文章列表在 0 篇文章时显示明确空状态；不得伪造演示文章或作者姓名。
- 若 profile 尚未存在，作者显示名使用 owner 邮箱的本地部分作为稳定临时值；site/profile 写接口后可保存正式资料。

### R3. 真实 owner 归属

- 读取 owner 管理数据必须以当前有效 session 的 `accountId` 过滤 `posts.owner_id`。
- 公共已发布内容仍只读取 `status = 'published' AND deleted_at IS NULL`，并保留当前登录保护。
- 页面作者、JSON-LD、侧栏和账号工作区不得读取本地 `content/site.ts` 的“林屿”作为 Neon 站点作者。

### R4. 站长文章管理

- `/account` 显示当前 owner 的文章统计和已发布文章列表，包含标题、状态、发布时间、版本和编辑入口；0 篇时显示空状态。
- 增加 owner-bound 文章详情/更新接口，至少支持修改已发布文章的标题、摘要、正文结构、分类、标签、封面和 featured 字段。
- 更新使用 `version` 乐观并发控制；版本冲突返回稳定错误且不得静默覆盖他人修改。
- 成功修改必须与审计事件在同一事务内完成，审计记录不得包含正文或密码。
- 文章更新必须验证 owner、字段结构、发布态完整性和 slug 不可变规则；不得允许修改 `owner_id`。

## Acceptance Criteria

- [ ] AC1：提供的清理 SQL 在事务中只删除本次 `local-import` 文章及孤立演示 taxonomy，owner/session/密码保持存在。
- [ ] AC2：内容表为空时，首页及内容相关页面返回 200，显示真实 owner 临时名称和空状态，不出现 500/React #441。
- [ ] AC3：Neon 查询返回的文章与管理列表均按当前 session 的 `accountId` 隔离，无法读取或修改其他 owner 的文章。
- [ ] AC4：`/account` 显示真实账号邮箱、作者信息、文章统计和已发布文章列表；没有文章时显示可操作的空状态。
- [ ] AC5：已发布文章可从账号页进入编辑并成功保存标题、摘要、正文结构、分类、标签、封面或 featured 变更。
- [ ] AC6：过期 version 更新返回 `VERSION_CONFLICT`，原文章内容不被覆盖；成功更新产生一条对应 audit event。
- [ ] AC7：现有 public read API、登录/session 行为不回归；test、lint、typecheck、webpack build 通过。
- [ ] AC8：浏览器验证空内容首页、真实作者显示、账号文章列表和已发布文章编辑闭环。

## Key Decision

- 已决策：本次提供完整的结构化 block 编辑器，覆盖 `heading`、`paragraph`、`list`、`quote`、`image`、`code` 的增删改、排序和预览；不采用仅暴露正文 JSON 的临时表单。

## Out of Scope

- 多账号协作、公开注册、定时发布、自动保存、Markdown/任意 HTML、taxonomy 删除/合并。
- 清理任何非 `local-import` 来源的文章或审计记录。
