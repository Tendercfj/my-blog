# 完整博客接口与管理 UI PRD

## 1. 目标与用户价值

将当前单账号个人博客从“本地静态内容 + 已完成展示 UI”补齐为可持续维护的完整全栈产品：唯一站长能够在浏览器中管理站点资料和文章，现有展示页能够读取同一份 Neon PostgreSQL 内容事实，页面、HTTP API、认证、状态迁移与数据库约束保持一致。

本任务采用逐页、逐接口可验收的方式实施，并以现有视觉语言和稳定 URL 为基础，不重做已经完成的 Tessera 风格页面。

## 2. 已确认事实

- 项目使用 Next.js `16.3.0` App Router、React `19.2.8`、TypeScript、Tailwind CSS 4 和 Neon PostgreSQL driver。
- 现有展示页面包括 `/`、`/archives`、`/tags`、`/tags/[slug]`、`/categories`、`/categories/[slug]`、`/about`、`/posts/[slug]`；另有 `/login` 和 `/account`。
- 展示页 UI、搜索、主题、响应式布局和本地内容 repository 已基本完成，但 `lib/content/repository.ts` 仍直接读取 `content/site.ts` 与 `content/posts.ts`。
- 当前已实现的 Route Handlers 只有注册、登录、退出、当前账号和媒体上传；内容读取、站长资料、文章 CRUD、状态动作、审计读取等接口只有契约，尚未实现。
- 已有任务 `.trellis/tasks/08-18-neon-api-database-docs` 提供 `api.md`、`schema.sql` 和总体 Neon 设计，可作为本任务的契约基线，但其当前实施范围明确排除了内容 repository 切换、文章 CRUD 和编辑 UI。
- 产品是单账号个人博客。匿名用户只能访问 `/login`；所有业务页面和内容 API 都要求有效 session。
- Server Components、metadata 和 Route Handlers 应直接复用 service/repository；服务端页面不得通过 HTTP 调用本应用自己的 `/api/v1`。
- 浏览器中的表单、上传、状态动作等交互通过 `/api/v1` 调用服务端。
- 数据源通过显式配置选择：生产环境强制使用 Neon，开发/测试可显式选择本地 adapter；Neon 查询失败时不得自动 fallback 到本地内容。
- 未经再次批准，本任务不连接真实 Neon、不执行远程 SQL、不使用真实凭据，也不修改生产环境。

## 3. 范围

### 3.1 数据与领域层

- 实现与现有 `SiteConfig`、`PostSummary`、`PostDetail`、taxonomy、归档、搜索、侧栏和统计契约兼容的 Neon repository。
- 实现站长文章模型、输入校验、状态机、cursor pagination、乐观并发、幂等创建和审计记录。
- 保留现有稳定 URL 和 DTO 语义；未知 slug 与合法空 taxonomy 必须继续区分。
- 提供可审阅、可回滚的本地内容导入或初始化路径，避免手工重复录入现有占位数据。
- 提供显式 CLI，将 `content/site.ts` 和 `content/posts.ts` 一次性导入 Neon；默认仅预览，只有传入 `--apply` 才写入。
- 导入在 direct connection 的单个事务内完成；目标已有文章时拒绝执行，不覆盖既有站长账号，失败时不留下部分内容。

### 3.2 展示页与读取接口

- 为站点配置、文章列表/详情、归档、标签、分类、搜索、统计和侧栏实现 `/api/v1` 读取接口。
- 将 `/`、`/archives`、`/tags`、`/tags/[slug]`、`/categories`、`/categories/[slug]`、`/about`、`/posts/[slug]` 切换到统一 service/repository 数据源。
- 保持现有页面视觉、响应式、metadata、404、空状态、搜索和侧栏体验；只在数据加载、错误或空状态确有缺口时补 UI。
- 所有读取接口验证 session，返回统一 JSON envelope、稳定错误 code 和 `private, no-store`。

### 3.3 站长账号与资料 UI

- 完善 `/account` 为站长工作台，展示账号、内容统计、最近文章和常用入口。
- 提供 `/account/profile`，编辑站名、描述、URL、Logo、公告、导航、作者资料、头像、links 和 about；对应 `/api/v1/me/site` 与 `/api/v1/me/profile`。
- 提供 `/account/security`，展示当前与其他有效 session，支持撤销单个 session 或全部退出。
- 提供 `/account/posts`，支持文章搜索、状态筛选、cursor pagination、回收站以及新建/编辑入口。
- 保留现有注册、登录、退出、当前账号和媒体上传能力，并补齐契约要求的 session 续期/失效能力。

### 3.4 文章管理 UI 与写接口

- 提供文章列表、创建、编辑、预览和回收站 UI；至少覆盖草稿、已发布、已归档和已删除筛选。
- 编辑器覆盖现有 `ContentBlock` 全部类型：heading、paragraph/inline content、list、quote、image、code。
- 正文采用结构化块编辑器，直接读写 `ContentBlock[]`；每个块支持新增、编辑、上下移动、复制和删除。
- 桌面和移动端统一使用明确按钮排序；MVP 不实现拖拽排序、Markdown 输入或 Markdown/blocks 双向转换。
- 编辑内容通过显式“保存草稿”操作提交，不实现自动保存；UI 必须显示保存中、成功、失败和版本冲突状态。
- 存在未保存修改时，站内导航、刷新或关闭页面必须给出离开确认，不能静默丢弃本地编辑内容。
- 提供草稿创建、详情、更新、软删除、恢复、发布、撤回发布、归档和撤销归档接口及操作反馈。
- 发布前验证标题、摘要、slug、正文、分类、封面和发布时间；字段错误在 UI 中可定位。
- 所有写操作从已验证 session 取得唯一站长 ID，不信任客户端提交的 `ownerId`。
- 更新和状态动作提交 `version`；冲突返回 `409 VERSION_CONFLICT`，UI 不静默覆盖服务器新版本。
- 创建支持 `Idempotency-Key`；状态变化和写操作生成可查询审计记录。
- 提供完整的审计事件读取 API；文章编辑页展示当前文章的最近事件。
- MVP 不新增独立审计中心页面，也不实现跨文章的高级筛选 UI。

### 3.5 分类与标签管理

- 文章编辑流程能够选择或创建分类与标签，并复用数据库唯一 slug 约束。
- 提供 `/api/v1/me/categories` 与 `/api/v1/me/tags` 的读取/创建能力；重复 name/slug 返回稳定冲突错误。
- 若独立 taxonomy 管理页对完成文章工作流不是必需，MVP 不单独建设；删除、合并和批量重命名作为后续能力。

## 4. 明确不在范围

- 多账号、多作者、角色、成员、邀请和 OAuth。
- 评论、点赞、订阅、浏览量、通知、审批流、多人协作和定时发布。
- 富文本 HTML 输入或未经结构校验的 `dangerouslySetInnerHTML`；正文继续使用结构化 `ContentBlock[]`。
- 图片裁剪、转换、媒体库删除和资源生命周期管理；本期复用现有 R2 上传并保存返回 URL。
- 未经用户单独批准的真实 Neon migration、生产 Secret、部署、CI/CD 或远程数据修改。
- 大幅重做已经完成的博客展示视觉或复制第三方站点内容。

## 5. 关键约束

- 页面、Route Handlers 和脚本共享领域校验与 repository，不得形成三套业务规则。
- 运行时使用 pooled `DATABASE_URL`；migration/import/admin 使用 direct `DATABASE_URL_UNPOOLED`。
- SQL 必须参数化，事务短小，不能依赖 Neon PgBouncer transaction mode 不支持的 session 状态。
- 保持单账号数据库约束、session 权威校验、同源写请求、限速和 HttpOnly Cookie 安全边界。
- API 和 UI 必须按现有项目样式、命名和组件模式实现；优先 Server Components，只在交互边界使用 Client Components。
- 数据源选择必须可观察且可验证；生产缺少 Neon 配置或数据库不可用时明确失败，不能悄悄展示过期本地数据。
- 实施前必须阅读项目内 Next.js `16.3.0` 对应文档，不能套用旧版 App Router 行为。

## 6. 验收标准

- [ ] AC1：所有现有业务展示页从统一 repository 读取内容，页面之间的文章、分类、标签、归档、搜索、侧栏和统计一致。
- [ ] AC2：`api.md` 中的站点、内容、taxonomy、搜索、统计和侧栏读取接口均有 Route Handler、认证、输入校验和稳定错误响应。
- [ ] AC3：`/account` 工作台能够进入 `/account/profile`、`/account/security`、`/account/posts`、新建和编辑流程，统计与 repository 一致。
- [ ] AC4：站点、作者和 about 可通过 UI 更新，版本冲突不会覆盖新值，展示页读取同一结果。
- [ ] AC5：session 列表、刷新、单个撤销和全部退出完整；撤销当前 session 会清除 Cookie 并返回 `/login`。
- [ ] AC6：唯一站长能在 UI 中创建草稿、编辑全部 `ContentBlock` 类型、选择/创建 taxonomy、上传封面/正文图片并预览结果。
- [ ] AC7：发布、撤回发布、归档、撤销归档、软删除和恢复均能从 UI 完成，并符合约定状态机。
- [ ] AC8：发布校验、重复 slug、无效 cursor/taxonomy、session 失效和数据库不可用都有稳定 API 错误及对应 UI 反馈。
- [ ] AC9：所有 owner 更新使用乐观并发；版本冲突保留本地编辑内容并提供导出或明确放弃后重载的安全路径。
- [ ] AC10：编辑器仅在用户明确保存时提交；存在未保存修改时离开、刷新或关闭会得到提示。
- [ ] AC11：文章创建安全重试不产生重复记录；文章、tag 关系、幂等结果与审计记录保持业务原子性。
- [ ] AC12：taxonomy 可在编辑流程读取/创建；MVP 没有删除、合并、批量重命名或独立管理页。
- [ ] AC13：未知 post/tag/category slug 返回 404；已存在但无已发布文章的 taxonomy 返回 200 空列表和现有空状态 UI。
- [ ] AC14：匿名请求不能访问业务页面、内容 API 或站长写接口；伪造、过期和已撤销 session 均失败。
- [ ] AC15：页面服务端读取不绕行内部 HTTP；浏览器交互使用版本化 `/api/v1`，DTO、校验和错误 envelope 只有一个共享契约。
- [ ] AC16：现有展示页布局不因数据源切换退化，展示和管理关键流程在 `1440×900`、`1024×768`、`390×844` 可用。
- [ ] AC17：导入 CLI 默认 dry-run；`--apply` 只在空内容库中单事务写入，不覆盖站长，重复执行安全拒绝。
- [ ] AC18：`pnpm test`、`pnpm lint`、`pnpm exec tsc --noEmit`、`pnpm build`、浏览器逐页验证和 Trellis 检查通过。

## 7. 子任务顺序

1. 数据库与内容基础：migration、显式数据源、repository adapters、导入和契约测试。
2. 内容读取接口与展示页：读取 Route Handlers、动态 slug 和现有 8 个页面切换。
3. 站长写接口：session、site/profile、taxonomy、文章 CRUD/action 和审计。
4. 账号管理 UI：工作台、资料、安全、文章列表和回收站。
5. 结构化文章编辑器：新建、blocks、预览、保存、冲突、状态动作和最近审计。
6. 全栈集成验收：端到端、安全、响应式、质量门、文档和父任务 AC 证据。

子任务按上述依赖顺序实施；每个子任务独立规划、验证和归档，父任务负责跨子任务契约与最终集成结论。
