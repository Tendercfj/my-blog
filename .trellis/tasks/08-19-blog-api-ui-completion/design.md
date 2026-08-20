# 完整博客接口与管理 UI 技术设计

## 1. 设计状态

本设计覆盖父任务的跨层契约、子任务边界和集成顺序。父任务不直接作为单次大改的实现目标；实施按 `implement.md` 中的子任务顺序逐个规划、启动、验证和归档。

不会在规划阶段连接真实 Neon、执行远程 SQL、写入真实凭据或修改生产环境。

## 2. 设计原则

1. 页面、HTTP API 和脚本共享 application service 与 repository，不复制业务规则。
2. Server Components 直接调用 service/repository；只有浏览器交互调用 `/api/v1`。
3. PostgreSQL row 先在 repository 边界通过 Zod 解码，再映射为领域 DTO；组件不读取数据库列。
4. 所有身份与所有权从权威 session 得到；客户端 ID、状态和时间戳都不作为可信事实。
5. 发布状态机、`ContentBlock` 校验、cursor、error code、DTO mapper 都只有一个所有者。
6. 生产内容读取失败明确报错，绝不自动回退到本地旧数据。
7. 保留已有展示 UI，只补数据状态、管理页面和必要的可复用组件。

## 3. 总体架构

```text
Browser
├─ page navigation ──> protected Server Components ──> application services
└─ editor/forms ─────> /api/v1 Route Handlers ───────> auth/origin/input guards
                                                       │
                                                       v
                                                application services
                                                       │
                         ┌─────────────────────────────┴─────────────────────────┐
                         v                                                       v
                 ContentRepository                                       OwnerRepository
                         │                                                       │
              explicit source selector                                         │
                 ┌───────┴───────┐                                               │
                 v               v                                               v
           local adapter    Neon read adapter <──────────────────────── Neon write adapter
                                  │                                               │
                                  └──────────────── PostgreSQL ───────────────────┘

import-local-content CLI ──> direct connection ──> one transaction ──> PostgreSQL
```

### 3.1 服务端内部调用

- 页面、metadata、Route Handlers 复用 service/repository 函数。
- 页面不得 `fetch("/api/v1/...")` 调用自身，以免增加网络跳转、重复序列化和认证分歧。
- Route Handlers 是外部 HTTP 契约的薄适配层：生成 request ID、认证、解析输入、调用 service、映射响应。
- authenticated reads 不建立跨请求公共缓存；同一 React 请求内可用 `React.cache` 去重 session 和重复读取。

### 3.2 Runtime

- 数据库、密码、R2 和所有 mutation Route Handlers 使用 Node runtime。
- 服务端数据模块继续 `import "server-only"`，避免进入 editor Client Component bundle。
- Client Components 只接收 JSON 可序列化 DTO、枚举和初始表单值。

## 4. 数据源与 repository

### 4.1 显式选择

新增服务端变量：

```text
BLOG_CONTENT_SOURCE=local|neon
```

- `NODE_ENV=production` 时只接受 `neon`。
- development/test 必须显式设置；测试脚本固定注入 `local` 或测试 Neon adapter。
- `neon` 缺少 `DATABASE_URL`、查询失败或数据非法时明确失败。
- selector 只选择一次 adapter，不捕获数据库异常并切到 local。

### 4.2 Repository ports

读取端保持现有页面所需能力，并增加分页参数：

- `getSiteConfig`
- `listPublishedPosts` / `getRecentPosts` / `getPublishedPostBySlug`
- `getArchiveGroups`
- `listTags` / `listPublishedPostsByTag`
- `listCategories` / `listPublishedPostsByCategory`
- `searchPublishedPosts`
- `getSiteStats` / `getSidebarData`

写端按 owner 绑定：

- owner site/profile read-update
- taxonomy list-create
- owner post list-detail-create-update
- publish/withdraw/archive/unarchive/delete/restore
- audit list
- session list/rotate/revoke

旧导出函数可作为兼容 facade，逐页迁移完成后再决定是否收窄；不得一次同时改动所有页面 DTO。

### 4.3 解码与派生

- repository row schemas 处理 UUID、`timestamptz`、nullable、`jsonb` 和别名。
- `ContentBlock`、navigation、author links、about 在共享 schema 中从 `unknown` 解码。
- word count、reading minutes、TOC、previous/next、archive 和 search projection 复用现有 `derive.ts` / `search.ts`，或迁入唯一共享 owner；不在 SQL、API 和 UI 各实现一次。
- 未知 taxonomy 返回 `null`；存在但无已发布文章返回空数组。

## 5. 数据库与导入

### 5.1 Migration

- 将已评审 `schema.sql` 提升为 `db/migrations/0001_baseline.sql`，并把已经存在的 R2 URL 约束增量合并为可追踪 migration。
- baseline 和增量 SQL 使用 direct connection；runtime 只使用 pooled connection。
- 添加 schema contract verification，覆盖 single owner、状态、slug、JSON 形状、version trigger、public view 和审计约束。
- 本任务只提交 migration 与验证脚本；对真实 Neon 执行仍需用户单独批准。

### 5.2 本地内容导入

新增 `pnpm content:import`：

- 默认 dry-run：加载并验证本地内容，连接目标后只报告 owner/site/content 状态和将写入的数量。
- `--apply` 才写入，且只读 `DATABASE_URL_UNPOOLED`。
- 目标存在任何 post 时拒绝；owner 可存在但不更新邮箱、密码或 session。
- site/profile 仅在 registration 默认值或缺失状态下填充本地内容；不无条件覆盖站长已经编辑的值。
- categories、tags、posts、post_tags 和必要 audit seed 在一个事务中写入。
- 任一 slug、引用或 JSON 校验失败整批回滚。
- 成功后再次运行因目标已有 post 而安全拒绝，不把重复执行当成 upsert。

## 6. HTTP API

### 6.1 读取接口

沿用既有 `/api/v1` 契约：

- `/site`
- `/posts`、`/posts/[slug]`
- `/archives`
- `/tags`、`/tags/[slug]/posts`
- `/categories`、`/categories/[slug]/posts`
- `/search`
- `/stats`
- `/sidebar`

所有接口要求有效 session，使用统一 envelope、cursor、错误 code 和 `private, no-store`。

### 6.2 认证与 session

保留现有 register/login/logout/me，并实现：

- `POST /auth/refresh`
- `GET /auth/sessions`
- `DELETE /auth/sessions/[sessionId]`
- `DELETE /auth/sessions`

所有 mutation 要求同源；撤销当前 session 时同步清除 Cookie。

### 6.3 站点与资料

- `GET/PATCH /me/profile`：作者、头像、links、about、`version`。
- `GET/PATCH /me/site`：站名、描述、URL、Logo、公告、navigation、`version`。
- 两类更新均使用乐观并发，并共用 LocalImage/link/navigation schemas。

### 6.4 Taxonomy

- `GET/POST /me/categories`
- `GET/POST /me/tags`

MVP 只提供选择和创建；不提供删除、合并、批量重命名或独立管理页。创建校验 name/slug，重复项映射为稳定冲突错误。

### 6.5 文章与审计

沿用既有 owner posts CRUD/action endpoints 和状态机。补充要求：

- create 必须使用 `Idempotency-Key`。
- PATCH 不接受状态、owner、published/archive/delete timestamps。
- post、tag relation、idempotency result 和 audit 在同一业务原子边界。
- 所有 action body 只接受 `version`。
- `GET /me/audit-events` 完整实现；UI 只按 `postId` 显示当前文章最近事件。

## 7. 页面与 UI

### 7.1 展示页

现有 8 个展示页保留 URL 和结构。逐页只替换 repository 调用，补齐：

- database loading/error/empty 状态；
- 新 slug 运行时可访问，不依赖 build-time `dynamicParams = false`；
- metadata 与页面使用同一已发布事实；
- 搜索文档、侧栏和统计与新发布/撤回状态同步。

### 7.2 管理页路由

```text
/account                         工作台：统计、最近文章、快捷入口、当前账号
/account/profile                 站点、作者和 about 设置
/account/security                当前 session 与其他 session 的撤销/全部退出
/account/posts                   文章列表、状态筛选、搜索、分页、回收站
/account/posts/new               创建草稿后进入编辑
/account/posts/[id]/edit         编辑、预览、状态动作、最近审计
```

所有管理页面位于现有 `(protected)` route group，不新增第二套认证 layout。

### 7.3 编辑器

- Server Component 读取初始文章/taxonomy，Client Component 管理尚未保存的表单状态。
- 元数据区编辑 title、slug、excerpt、category、tags、featured、cover。
- 结构化块区支持 heading、paragraph + inline text/link/code、list、quote、image、code。
- 块操作为新增、编辑、上移、下移、复制、删除；按钮具有可访问名称和禁用边界。
- 桌面为编辑/预览双栏或可切换区域；移动端以 tabs 在编辑与预览间切换。
- preview 复用现有 block renderer 的纯展示核心，不能另写一套渲染规则。
- 图片先经现有 media client 上传，成功 URL 只进入本地未保存表单；文章保存失败不删除已上传对象。

### 7.4 保存、冲突与离开保护

- 只有明确保存按钮提交 PATCH；不做自动保存。
- `dirty` 由当前规范化表单值与最近服务端快照比较，不以单一事件布尔值猜测。
- 刷新/关闭使用 `beforeunload`；编辑页自己的 Link、返回按钮和程序式导航统一经过 confirm guard。
- 保存成功用响应 DTO 替换服务端快照并清除 dirty。
- `409 VERSION_CONFLICT` 保留全部本地表单状态，显示服务器已更新提示；不自动重试或 force overwrite。
- 用户可复制/导出当前结构化草稿，或明确放弃本地内容后重新读取服务器版本。

### 7.5 状态动作

- publish/withdraw/archive/unarchive/delete/restore 使用确认 Dialog、pending 禁用和成功反馈。
- 发布字段错误映射到对应表单字段/块；不只显示顶部通用错误。
- 状态动作成功后使用返回的 `OwnerPostDto` 更新 UI，再 `router.refresh()` 更新 Server Component 外围数据。
- 删除后进入回收站或列表；恢复后保持 draft，不自动公开。

## 8. 错误、安全与可观测性

- 共享 browser API client 从 `unknown` 解码 success/error envelope；禁止每个表单局部 cast。
- request ID 在错误 UI 可复制，用于服务端排查；客户端不显示 SQL、表名、连接串或 stack。
- Origin、session、owner、version 和 input validation 在每个 mutation 入口执行。
- 图片 URL、链接协议、heading ID、slug、cursor 和 JSON blocks 都有共享 schema。
- 读取与写入日志不得包含正文、password、Cookie、session token/hash 或数据库 URL。
- 无 session 的 API 返回 JSON 401，不由 Proxy 重定向成 HTML。

## 9. 测试策略

### 9.1 自动化

- 引入一个最小 TypeScript test runner，并提供单一 `pnpm test`。
- domain tests：ContentBlock schema、状态机、发布校验、cursor、normalization、dirty comparison。
- repository contract tests：local fixture 与 Neon fixture 得到一致 DTO/排序/empty-not-found 语义。
- Route Handler contract tests：认证、方法、输入、envelope、错误映射和 cache header。
- SQL contract tests：只对 disposable PostgreSQL/明确批准的隔离 Neon 执行。

### 9.2 浏览器

- 展示页：`1440×900`、`1024×768`、`390×844`。
- 管理页：工作台、设置、session、列表、新建、编辑、预览、冲突和回收站。
- 逐项检查 keyboard/focus、unsaved guard、loading/error/empty、上传、动作确认和移动端无横向溢出。

## 10. 子任务边界与顺序

父任务实施时建立以下顺序子任务：

1. `database-content-foundation`：migration、source selector、repository ports/adapters、row decode、import CLI、contract tests。
2. `content-read-api-pages`：全部读取 Route Handlers、动态 slug、8 个展示页切换与浏览器回归。
3. `owner-write-api`：session、site/profile、taxonomy、owner posts、状态机、审计及测试。
4. `account-management-ui`：工作台、profile/site、security、文章列表与回收站。
5. `structured-post-editor`：新建、编辑、blocks、preview、upload、manual save、conflict/dirty guard、状态动作与最近审计。
6. `full-stack-integration-check`：全链路测试、三档视口、安全检查、文档和最终质量门。

每个子任务独立拥有 PRD/必要设计/实施计划和验收证据。后一个子任务只在依赖的前一个子任务质量门通过后启动。

## 11. Rollback

- 所有真实数据库操作都不在默认实施授权内；若未来批准，只对 disposable/isolated 环境先执行。
- 读取切换通过显式 `BLOG_CONTENT_SOURCE` 回到 local，但生产禁止 local；回滚只用于开发/验证，不掩盖生产故障。
- mutation endpoints 可通过 server-only kill switch 暂停，不能通过删除数据回滚。
- UI 子任务可按 route/component 边界回退，不改变数据库事实。
- 已通过写接口产生的数据永不由代码回滚自动覆盖或删除。
