# Neon 接口文档与数据库 SQL 梳理 PRD

## 1. 目标

为当前 Next.js 单账号个人博客整理并实施一套面向 Neon PostgreSQL 的认证与内容访问边界：唯一站长可在 `/login` 完成首次 Web 注册或后续登录，未认证用户不能查看 `/login` 之外的业务页面或内容 API，同时保持既有页面 URL、内容领域模型和单账号所有权不变量。

本任务继续维护可评审的 API 契约与 baseline SQL，并实施首次注册、全站会话保护和相应 UI。任务不会连接或修改真实 Neon 项目，不执行远程 SQL，也不读取或写入真实账号凭据。

## 2. 已确认事实

- 用户指定数据库平台为 Neon，底层数据库为 PostgreSQL。
- 产品形态为单账号个人博客：数据库最多存在一个站长账号，不支持多作者、角色或成员管理。
- 用户在 2026-08-19 确认开放无 setup secret 的首次 Web 注册；仅当账号表为空时可注册，账号存在后注册永久关闭。
- 现有 `bootstrap-owner` CLI 继续作为可选的离线初始化方式，与 Web 注册竞争同一个数据库单例约束，不覆盖既有账号。
- 凭据遗失时通过本地 CLI 安全轮换密码并撤销全部既有 session，不直接编辑明文凭据。
- 当前项目使用 Next.js 16 App Router、React 19 和 TypeScript。
- 当前内容来自本地 `content/*.ts`；项目已实现 login、logout、me Route Handlers、opaque session、Argon2id 密码校验和受保护 `/account`，尚未实现 Web 注册或全站页面保护。
- 当前领域模型包含站点配置、作者资料、文章、结构化正文 blocks、分类、标签、文章标签关系、归档分组、搜索文档和派生统计。
- 页面需要保留 `/posts/[slug]`、`/tags/[slug]`、`/categories/[slug]` 等稳定 URL，并区分未知 slug 与合法空 taxonomy。
- Neon 官方文档确认：
  - 应通过环境变量保存连接串，不能将凭据硬编码进源码。
  - Web/API 运行时优先使用 hostname 带 `-pooler` 的 pooled connection。
  - schema migration、`pg_dump`、`pg_restore` 和依赖 session 状态的管理任务使用 direct connection。
  - Neon PgBouncer 使用 transaction mode；不能依赖 session 级 `SET`、`LISTEN/NOTIFY`、session advisory lock 或需要跨事务保持的临时表。
  - `@neondatabase/serverless` 的 HTTP 模式适用于 one-shot query 和非交互事务；需要交互事务或 session 时才使用 WebSocket `Pool` / `Client`。

## 3. 交付物

1. `api.md`：已发布内容读取、账号认证和个人文章管理 REST API 契约，包括路径、方法、查询参数、请求/响应 JSON、分页、排序、错误码、缓存语义、身份认证和资源所有权边界。
2. `schema.sql`：适用于 Neon PostgreSQL 的 schema，包括表、字段、主外键、唯一约束、检查约束、索引、更新时间触发器和必要注释。
3. `design.md`：说明 Next.js Route Handlers、repository adapter、Neon driver、连接池、事务、缓存、迁移与安全边界。
4. `implement.md`：若后续批准接入，提供有序实施、验证命令、迁移步骤和回滚点；本任务不因产出该计划而自动开始代码改造。

### 3.1 当前实施基线

- `/login` 提供邮箱密码登录，成功后设置 HttpOnly session Cookie 并跳转 `/account`。
- `/account` 已执行服务端 session 校验并提供退出入口。
- login、logout、me Route Handlers、Argon2id 校验、opaque session token hash 和邮箱维度登录限速已经存在。
- direct connection 的 `auth:bootstrap`、`auth:reset-password` CLI、`.env.example` 和本地初始化文档已经存在。

### 3.2 本次实施切片

- 在 `/login` 内增加“登录 / 首次注册”切换，不新增匿名可访问的 `/register` 页面；注册表单收集邮箱、密码和确认密码。
- `POST /api/v1/auth/register` 在服务端严格校验输入、同源请求和限速，使用 Argon2id 保存 password hash，并原子创建唯一账号、默认作者资料、缺失的站点配置和首个 session。
- 注册不要求 setup secret、邀请码或邮件验证；用户接受公网部署后唯一账号可能被抢先注册的风险。
- 仅当 `owner_accounts` 为空时允许注册；并发首次注册由 `singleton_key = 1` 唯一约束仲裁，唯一成功者获得 session，其余请求返回稳定的 `409 REGISTRATION_CLOSED`。
- 未认证用户只能访问 `/login` 页面；首页、文章、归档、标签、分类、关于页、账号页及后续业务页面统一置于受保护 route group，并在服务端验证有效 session。
- 根 `proxy.ts` 只做 Cookie 存在性的乐观重定向；受保护 layout 和 Route Handlers 必须查询数据库验证 session，不能把 Proxy 当作授权边界。
- `/api/v1/auth/login`、`/api/v1/auth/register` 及必要的认证响应、Next.js 内部资源和静态资源使用最小匿名白名单；内容 API 即使读取已发布文章也必须认证。
- 已登录用户访问 `/login` 时跳转 `/account`；退出后撤销数据库 session、清除 Cookie 并返回 `/login`。

## 4. 数据建模要求

- 使用 PostgreSQL 原生能力，SQL 不依赖 Neon 专有表或控制面 API。
- 主业务实体使用 UUID 主键；对外路由继续使用不可变且唯一的小写 slug。
- 文章至少包含标题、摘要、状态、发布时间、更新时间、分类、封面、本地元信息和结构化正文。
- 结构化正文与现有 `ContentBlock` 判别联合保持可映射；优先使用 `jsonb` 保存有序 blocks，并使用数据库约束和应用层校验共同保证结构。
- 分类和标签独立建表；文章与标签使用多对多关联表；文章与分类使用外键。
- 唯一站长账号、认证凭据和 session 由项目自研认证模型管理，不依赖 Neon Managed Better Auth、Auth.js 或第三方身份平台。
- 数据库必须约束系统最多只能存在一个站长账号；Web 注册只是创建该唯一账号的首次初始化入口，不为多账号并存或角色扩展预留产品行为。
- 文章具有 `draft`、`published`、`archived` 状态；所有文章固定归属唯一站长账号，数据库保存所有者、发布时间、归档时间和乐观并发版本号。
- 撤回发布保留首次发布时间；归档可撤销为草稿；软删除和恢复都以草稿为安全落点，恢复不会让文章自动重新公开。
- 已发布文章的 slug 默认不可修改，保证现有公开 URL 稳定；如未来需要改 slug，应另行设计 redirect 表，不在本期隐式改变链接。
- 文章写操作保留审计记录，至少包含账号、动作、文章 ID、请求关联 ID、发生时间和必要的状态变更摘要。
- 统计值、归档年份、标签/分类计数、字数和阅读时间保持派生，不在多个表重复维护事实。
- 所有时间字段使用 `timestamptz`；内容日期对外仍按稳定 ISO 日期输出。
- SQL 必须可重复审阅，明确 destructive migration 不属于本期交付。

## 5. API 要求

- API 采用版本化前缀 `/api/v1`，错误响应使用统一 envelope 和稳定错误 code。
- 列表接口采用 cursor pagination，不使用数据增长后不稳定的纯 offset pagination。
- 已发布内容接口覆盖文章列表/详情、归档、标签、分类、搜索、站点配置和统计，但全部要求有效 session。
- 自研认证 API 覆盖首次注册、邮箱密码登录、退出、刷新/续期、当前账号和 session 失效；凭据恢复仍仅由本地 CLI 完成，不提供密码找回接口。
- 登录后的个人文章接口覆盖草稿创建、站长文章列表、详情、编辑、软删除、恢复、发布、撤回发布、归档和撤销归档。
- 只有通过认证的唯一站长账号能读取任何博客内容，以及读取草稿、归档和已删除文章，或修改、发布、归档、删除和恢复文章；匿名访问者不能读取博客内容。
- 个人资料接口允许唯一站长账号读取和更新公开作者资料；不提供独立管理后台、成员管理或全站管理 API。
- 文章状态迁移使用专用 action endpoint，不允许普通 `PATCH` 任意写入状态或发布时间。
- 发布动作必须校验标题、摘要、slug、正文、分类、封面和发布时间等完整性；校验失败返回稳定的字段错误。
- 站长写接口使用乐观并发控制；客户端提交当前 `version`，版本冲突返回 `409 VERSION_CONFLICT`。
- 创建接口支持 `Idempotency-Key`；相同主体与 key 的安全重试返回同一结果，不重复创建资源。
- 文章删除采用软删除；已发布内容读取永远过滤草稿、归档和已删除记录，本人接口可按显式筛选查看可恢复记录。
- API 字段命名、null 语义、排序规则与当前 repository 契约一致。
- 未知 post/tag/category slug 返回 `404`；合法但无文章的 taxonomy 返回 `200` 和空列表。
- 数据库查询必须参数化，搜索输入不得进入动态 SQL 标识符。
- 因全部内容受登录保护，内容页面和 API 一律使用 `private, no-store`，不得进入公共 CDN cache；发布状态仍决定登录后可见的正式内容集合。

## 6. Neon 连接与安全要求

- 文档区分 `DATABASE_URL`（pooled runtime）和 `DATABASE_URL_UNPOOLED`（direct migration/admin），示例只使用占位值。
- 应用运行时凭据仅存在于服务端环境变量，不进入 `NEXT_PUBLIC_*`、客户端 bundle、日志或文档真实示例。
- 运行时查询使用最小权限应用角色；migration 使用独立高权限角色。
- Web 注册使用 `DATABASE_URL` pooled runtime 连接与单条数据修改 CTE/等价短事务原子创建账号、profile、site singleton 和 session；不得先创建账号再以非原子请求补 session。
- `bootstrap-owner` CLI 使用 `DATABASE_URL_UNPOOLED`，若唯一站长账号已存在则安全失败；凭据恢复必须在一个事务中更新 password hash 并撤销该账号的全部 session。
- 不把 `neondb_owner` 作为未来面向不可信用户上下文的运行时角色。
- 写事务必须短小，不能依赖 PgBouncer transaction mode 不支持的 session 状态。
- 文档说明 transient connection failure 的有限重试边界：只重试幂等读取或具备幂等键的安全写入。
- 所有 `/api/v1/me/**` 写接口必须先完成服务端身份认证，并校验 session 对应唯一站长账号；不能只依赖前端隐藏入口或请求中的用户 ID。
- 客户端不能提交可信的 `owner_id`；服务端从已验证 session 获取唯一站长账号 ID，创建文章时自动写入该 ID，后续查询和写入继续限定该所有者。
- 密码不得明文保存；`schema.sql` 只定义算法无关的 `password_hash`。登录按 normalized email 限速，首次注册使用独立的全站单例预算，session token 只以 hash 入库，Cookie 使用安全属性并支持轮换和撤销。

## 7. 明确不在范围

- 创建或配置真实 Neon 项目、branch、database、role 或 Secret。
- 执行 SQL 到任何远程数据库。
- 当前认证切片之外的内容 Neon repository 切换、文章 CRUD/action Route Handlers 和文章编辑 UI。
- 数据库备份、跨区域容灾、计费配置、BI/read replica 和生产监控落地。
- 评论、点赞、订阅、浏览量和用户画像等当前博客没有的业务领域。
- 媒体删除、转换、图片裁剪和独立资源表；R2 上传只返回公开 URL，由现有头像或文章保存接口写入对应字段。
- 多人实时协作编辑、文章定时发布、审批流和多语言内容。
- 独立管理后台、管理员/编辑角色、成员权限管理和代替其他账号编辑内容。
- 多账号、多作者、账号邀请、账号切换和跨账号数据隔离策略。
- setup secret、邀请码、邮件验证码、忘记密码邮件、第三方 OAuth 和第三方身份平台。

## 8. 验收标准

- [ ] AC1：`api.md` 覆盖当前 repository 的全部已发布内容读取能力，并给出可复制的认证请求/响应示例。
- [ ] AC2：所有接口明确 HTTP 方法、路径、查询参数、状态码、错误 code、分页和排序。
- [ ] AC2a：站长认证、站长文章、个人资料和审计接口具有逐接口身份要求与认证失败示例；只有首次注册与登录允许匿名调用。
- [ ] AC2b：草稿、发布、撤回发布、归档、撤销归档、软删除和恢复具有明确状态迁移、校验失败与冲突行为；恢复不会自动公开文章。
- [ ] AC3：`schema.sql` 可作为一次 prepared Query 在标准 PostgreSQL/Neon 环境按依赖顺序、原子执行，不包含真实连接串或 Secret。
- [ ] AC4：文章、分类、标签、关联、站点配置和结构化正文均有明确表/字段映射。
- [ ] AC5：主外键、slug 唯一性、状态、日期、正文非空等核心不变量由 SQL 约束或文档标明的应用层校验承担。
- [ ] AC6：索引覆盖已设计的列表、slug 详情、taxonomy 筛选、时间排序和搜索路径，且说明每个非显然索引的用途。
- [ ] AC7：运行时 pooled connection 与迁移 direct connection 的用途明确，不使用 PgBouncer transaction mode 不支持的 session 依赖。
- [ ] AC8：未知 slug、合法空 taxonomy、重复 slug、无效 cursor 和数据库暂时不可用均有确定响应。
- [ ] AC9：接口 DTO 与当前 `PostSummary`、`PostDetail`、`TaxonomySummary`、`ArchiveYearGroup`、`SearchDocument` 和 `SiteStats` 可追踪映射。
- [ ] AC10：文档和实施均不连接远程 Neon、不执行远程 SQL 或使用真实凭据；真实环境迁移需要再次批准。
- [ ] AC11：所有文章写接口采用参数化 SQL、短事务、乐观并发与审计记录，并说明可重试与不可重试边界。
- [ ] AC12：匿名访问者与已认证唯一站长账号的能力边界可从页面、API 和 SQL 一致推导；数据库能够拒绝第二个账号。
- [ ] AC13：密码、session、Cookie、注册/登录限速和未认证资源访问均有明确安全契约，SQL 不保存明文密码或明文 session token。
- [ ] AC14：首次注册原子创建账号、默认 profile、缺失的 site singleton 和 session；账号已存在或并发失败返回 `409 REGISTRATION_CLOSED` 且不覆盖数据。
- [ ] AC15：`/login` 同时提供登录与首次注册，禁止索引且不进入 sitemap；未认证访问任何业务页面都会跳转 `/login`。
- [ ] AC16：注册或登录成功设置 HttpOnly session Cookie 并跳转 `/account`；校验失败、限速、注册关闭、缺少配置和数据库不可用都有稳定错误。
- [ ] AC17：所有业务页面由受保护 layout 完成数据库 session 校验；内容 API 无有效 session 返回 JSON `401`，不返回重定向 HTML。
- [ ] AC18：退出会撤销数据库 session、清除 Cookie 并返回 `/login`；bootstrap 仍拒绝覆盖账号，reset 会原子更新密码并撤销全部 session。
- [ ] AC19：无 Cookie 的乐观 Proxy 重定向和服务端权威校验均有测试；伪造、过期或已撤销 Cookie 不能访问业务页面。
- [ ] AC20：`schema.sql` 保持单账号约束，支持注册/登录独立限速种类，并授予 runtime 完成首次注册所需的最小 INSERT 权限。
- [ ] AC21：`pnpm lint`、`pnpm exec tsc --noEmit`、`pnpm build` 通过，且浏览器验证登录、首次注册、注册关闭、保护跳转与退出流程。
