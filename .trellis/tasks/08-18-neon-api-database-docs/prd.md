# Neon 接口文档与数据库 SQL 梳理 PRD

## 1. 目标

为当前 Next.js 单账号个人博客整理一套面向 Neon PostgreSQL 的后端契约，产出可评审的接口文档和可执行数据库 SQL，使后续把本地静态内容 repository 替换为 Neon 数据源，并允许唯一站长账号登录后管理文章时，页面领域模型、路由语义和统计口径保持稳定。

本任务先完成设计与数据库脚本；用户在 2026-08-18 进一步批准实现登录入口。当前实施切片只接入单账号认证闭环，不连接或修改真实 Neon 项目，也不读取或写入真实账号凭据。

## 2. 已确认事实

- 用户指定数据库平台为 Neon，底层数据库为 PostgreSQL。
- 产品形态为单账号个人博客：系统只有一个站长账号，不开放访客注册，不支持多作者、角色或成员管理。
- 唯一站长账号通过本地一次性 `bootstrap-owner` CLI 使用 direct connection 初始化，以邮箱和密码登录；不提供 Web 注册、初始化或邮件找回流程。
- 凭据遗失时通过本地 CLI 安全轮换密码并撤销全部既有 session，不直接编辑明文凭据。
- 当前项目使用 Next.js 16 App Router、React 19 和 TypeScript。
- 当前内容来自本地 `content/*.ts`，`lib/content/repository.ts` 只暴露公开读取能力，没有 Route Handlers、数据库驱动、ORM、认证或后台管理。
- 当前领域模型包含站点配置、作者资料、文章、结构化正文 blocks、分类、标签、文章标签关系、归档分组、搜索文档和派生统计。
- 页面需要保留 `/posts/[slug]`、`/tags/[slug]`、`/categories/[slug]` 等稳定 URL，并区分未知 slug 与合法空 taxonomy。
- Neon 官方文档确认：
  - 应通过环境变量保存连接串，不能将凭据硬编码进源码。
  - Web/API 运行时优先使用 hostname 带 `-pooler` 的 pooled connection。
  - schema migration、`pg_dump`、`pg_restore` 和依赖 session 状态的管理任务使用 direct connection。
  - Neon PgBouncer 使用 transaction mode；不能依赖 session 级 `SET`、`LISTEN/NOTIFY`、session advisory lock 或需要跨事务保持的临时表。
  - `@neondatabase/serverless` 的 HTTP 模式适用于 one-shot query 和非交互事务；需要交互事务或 session 时才使用 WebSocket `Pool` / `Client`。

## 3. 交付物

1. `api.md`：公开读取、账号认证和个人文章管理 REST API 契约，包括路径、方法、查询参数、请求/响应 JSON、分页、排序、错误码、缓存语义、身份认证和资源所有权边界。
2. `schema.sql`：适用于 Neon PostgreSQL 的 schema，包括表、字段、主外键、唯一约束、检查约束、索引、更新时间触发器和必要注释。
3. `design.md`：说明 Next.js Route Handlers、repository adapter、Neon driver、连接池、事务、缓存、迁移与安全边界。
4. `implement.md`：若后续批准接入，提供有序实施、验证命令、迁移步骤和回滚点；本任务不因产出该计划而自动开始代码改造。

### 3.1 已批准的登录实施切片

- 桌面 Header 和移动 Drawer 提供站长登录入口。
- `/login` 提供邮箱密码表单；成功后跳转 `/account`。
- `/account` 通过服务端 session 保护，并提供退出入口。
- 实现 login、logout、me Route Handlers、Argon2id 校验、opaque session Cookie、数据库 token hash 和邮箱维度登录限速。
- 提供 direct connection 的 `auth:bootstrap` 与 `auth:reset-password` CLI。
- 提供 `.env.example` 和本地初始化说明，但不代替用户执行真实 Neon 配置或 SQL。

## 4. 数据建模要求

- 使用 PostgreSQL 原生能力，SQL 不依赖 Neon 专有表或控制面 API。
- 主业务实体使用 UUID 主键；对外路由继续使用不可变且唯一的小写 slug。
- 文章至少包含标题、摘要、状态、发布时间、更新时间、分类、封面、本地元信息和结构化正文。
- 结构化正文与现有 `ContentBlock` 判别联合保持可映射；优先使用 `jsonb` 保存有序 blocks，并使用数据库约束和应用层校验共同保证结构。
- 分类和标签独立建表；文章与标签使用多对多关联表；文章与分类使用外键。
- 唯一站长账号、认证凭据和 session 由项目自研认证模型管理，不依赖 Neon Managed Better Auth、Auth.js 或第三方身份平台。
- 数据库必须约束系统最多只能存在一个站长账号；不为公开注册、多账号并存或角色扩展预留产品行为。
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
- 公开读取接口覆盖文章列表/详情、归档、标签、分类、搜索、站点配置和统计。
- 自研认证 API 覆盖邮箱密码登录、退出、刷新/续期、当前账号和 session 失效；账号初始化与凭据恢复仅由本地 CLI 完成，不提供注册、Web 初始化或密码找回接口。
- 登录后的个人文章接口覆盖草稿创建、站长文章列表、详情、编辑、软删除、恢复、发布、撤回发布、归档和撤销归档。
- 只有通过认证的唯一站长账号能读取草稿、归档和已删除文章，或修改、发布、归档、删除和恢复文章；匿名访问者只能读取公开内容。
- 个人资料接口允许唯一站长账号读取和更新公开作者资料；不提供独立管理后台、成员管理或全站管理 API。
- 文章状态迁移使用专用 action endpoint，不允许普通 `PATCH` 任意写入状态或发布时间。
- 发布动作必须校验标题、摘要、slug、正文、分类、封面和发布时间等完整性；校验失败返回稳定的字段错误。
- 站长写接口使用乐观并发控制；客户端提交当前 `version`，版本冲突返回 `409 VERSION_CONFLICT`。
- 创建接口支持 `Idempotency-Key`；相同主体与 key 的安全重试返回同一结果，不重复创建资源。
- 文章删除采用软删除；公开读取永远过滤草稿、归档和已删除记录，本人接口可按显式筛选查看可恢复记录。
- API 字段命名、null 语义、排序规则与当前 repository 契约一致。
- 未知 post/tag/category slug 返回 `404`；合法但无文章的 taxonomy 返回 `200` 和空列表。
- 数据库查询必须参数化，搜索输入不得进入动态 SQL 标识符。
- 公开缓存只能覆盖已发布内容；草稿或受保护内容不得进入公共缓存。

## 6. Neon 连接与安全要求

- 文档区分 `DATABASE_URL`（pooled runtime）和 `DATABASE_URL_UNPOOLED`（direct migration/admin），示例只使用占位值。
- 应用运行时凭据仅存在于服务端环境变量，不进入 `NEXT_PUBLIC_*`、客户端 bundle、日志或文档真实示例。
- 运行时查询使用最小权限应用角色；migration 使用独立高权限角色。
- `bootstrap-owner` CLI 使用 `DATABASE_URL_UNPOOLED`，初始化时若唯一站长账号已存在则安全失败；凭据恢复必须在一个事务中更新 password hash 并撤销该账号的全部 session。
- 不把 `neondb_owner` 作为未来面向不可信用户上下文的运行时角色。
- 写事务必须短小，不能依赖 PgBouncer transaction mode 不支持的 session 状态。
- 文档说明 transient connection failure 的有限重试边界：只重试幂等读取或具备幂等键的安全写入。
- 所有 `/api/v1/me/**` 写接口必须先完成服务端身份认证，并校验 session 对应唯一站长账号；不能只依赖前端隐藏入口或请求中的用户 ID。
- 客户端不能提交可信的 `owner_id`；服务端从已验证 session 获取唯一站长账号 ID，创建文章时自动写入该 ID，后续查询和写入继续限定该所有者。
- 密码不得明文保存；`schema.sql` 只定义算法无关的 `password_hash`，技术方案必须规定现代 password hashing、登录限速、session token 哈希存储、轮换、撤销和安全 Cookie。

## 7. 明确不在范围

- 创建或配置真实 Neon 项目、branch、database、role 或 Secret。
- 执行 SQL 到任何远程数据库。
- 当前登录切片之外的公开内容 Neon repository 切换、文章 CRUD/action Route Handlers 和文章编辑 UI。
- 数据库备份、跨区域容灾、计费配置、BI/read replica 和生产监控落地。
- 评论、点赞、订阅、浏览量和用户画像等当前博客没有的业务领域。
- 媒体上传与对象存储；本期站长文章接口只管理已经存在的图片元数据和路径。
- 多人实时协作编辑、文章定时发布、审批流和多语言内容。
- 独立管理后台、管理员/编辑角色、成员权限管理和代替其他账号编辑内容。
- 公开注册、多账号、多作者、账号邀请、账号切换和跨账号数据隔离策略。
- Web 账号初始化、邮件验证码、忘记密码邮件、第三方 OAuth 和第三方身份平台。

## 8. 验收标准

- [ ] AC1：`api.md` 覆盖当前 repository 的全部公开读取能力，并给出可复制的请求/响应示例。
- [ ] AC2：所有接口明确 HTTP 方法、路径、查询参数、状态码、错误 code、分页和排序。
- [ ] AC2a：站长认证、站长文章、个人资料和审计接口具有逐接口身份要求与认证失败示例，且不存在公开注册接口。
- [ ] AC2b：草稿、发布、撤回发布、归档、撤销归档、软删除和恢复具有明确状态迁移、校验失败与冲突行为；恢复不会自动公开文章。
- [ ] AC3：`schema.sql` 可在标准 PostgreSQL/Neon 环境按依赖顺序执行，不包含真实连接串或 Secret。
- [ ] AC4：文章、分类、标签、关联、站点配置和结构化正文均有明确表/字段映射。
- [ ] AC5：主外键、slug 唯一性、状态、日期、正文非空等核心不变量由 SQL 约束或文档标明的应用层校验承担。
- [ ] AC6：索引覆盖已设计的列表、slug 详情、taxonomy 筛选、时间排序和搜索路径，且说明每个非显然索引的用途。
- [ ] AC7：运行时 pooled connection 与迁移 direct connection 的用途明确，不使用 PgBouncer transaction mode 不支持的 session 依赖。
- [ ] AC8：未知 slug、合法空 taxonomy、重复 slug、无效 cursor 和数据库暂时不可用均有确定响应。
- [ ] AC9：接口 DTO 与当前 `PostSummary`、`PostDetail`、`TaxonomySummary`、`ArchiveYearGroup`、`SearchDocument` 和 `SiteStats` 可追踪映射。
- [ ] AC10：文档明确本期不连接远程 Neon、不实施 API/数据库接入，后续实现需要再次批准。
- [ ] AC11：所有文章写接口采用参数化 SQL、短事务、乐观并发与审计记录，并说明可重试与不可重试边界。
- [ ] AC12：匿名访问者与已认证唯一站长账号的能力边界可从接口文档和 SQL 所有权模型中一致推导，数据库能够拒绝第二个账号。
- [ ] AC13：密码、session、Cookie、登录限速和未认证资源访问均有明确安全契约，SQL 不保存明文密码或明文 session token。
- [ ] AC14：文档明确 `bootstrap-owner` CLI 的初始化、重复执行失败和凭据恢复行为；恢复操作会撤销全部既有 session，且 API 中不存在注册或密码找回端点。
- [ ] AC15：桌面和移动导航都有可访问的 `/login` 入口，登录页不进入 sitemap 且禁止索引。
- [ ] AC16：登录成功设置 HttpOnly session Cookie 并跳转 `/account`；无效凭据、限速、缺少配置和数据库不可用都有稳定错误。
- [ ] AC17：`/account` 无有效 session 时跳转登录，退出会撤销数据库 session 并清除 Cookie。
- [ ] AC18：bootstrap 不接收 argv 密码且拒绝覆盖已有账号；reset 会原子更新密码并撤销全部 session。
- [ ] AC19：未配置真实 Neon 时公开博客页面、lint、typecheck 和 build 仍可正常完成。
