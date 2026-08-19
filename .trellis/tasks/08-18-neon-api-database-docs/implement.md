# 单账号个人博客 Neon 接入实施计划

## 1. 计划边界

本文件保留完整 Neon 接入顺序，但下一实施切片限定为 2026-08-19 已规划的“单账号首次注册 + 全站 session 保护”。当前仍不执行以下操作：

- 不创建/修改真实 Neon branch、database、role 或 Secret；
- 不执行本任务 SQL；
- 不实现内容 Neon adapter、文章 CRUD/action Route Handlers 或文章编辑 UI；
- 不把现有本地内容切换到数据库。

当前仓库已有 Git 且工作树基线干净；任务状态已经是 `in_progress`，但因需求发生实质变化，必须在用户批准本次最新规划摘要后才恢复产品代码修改。实现时保留用户已有改动，不执行远程 Neon 操作。

## 2. 实施目标

- 在现有 login/logout/me/session 实现上增加无 setup secret 的单账号首次 Web 注册。
- `/login` 同时承载登录和注册；注册原子创建唯一账号、profile、site settings 与 session，并发只允许一个成功。
- 未认证用户不能访问 `/login` 之外的业务页面或内容 API；Proxy 只做乐观检查，protected layout/API 做权威数据库校验。
- 更新 baseline SQL、API/设计契约、初始化说明和 runtime 最小权限模板，不执行真实 SQL。
- 保持现有页面 URL、视觉结构、本地内容 repository、opaque session 和 CLI 恢复流程。

## 3. Phase 0：启动门与基线

- [x] 用户评审最新 `prd.md`、`api.md`、`schema.sql`、`design.md`、`implement.md` 并明确批准实施。
- [x] 确认当前 task 仍为 `in_progress`；不得重复运行 `task.py start`。
- [x] 读取 `trellis-before-dev` 和 `.trellis/spec/` 对应规范。
- [x] 记录当前 Git 分支/工作树、`package.json`、lockfile、认证调用链、页面树与环境文件基线。
- [x] 检查工作区现有修改，避免覆盖父任务未提交成果。
- [ ] 运行当前质量基线并保存输出：

```bash
rtk pnpm lint
rtk pnpm exec tsc --noEmit
rtk pnpm build
```

完成定义：最新规划已获批准；基线命令结果和现有环境限制有记录；尚未接触真实 Neon。

回滚点：无产品文件修改；不得在本阶段运行远程 SQL。

## 4. Phase 1：依赖与服务端环境边界

- [ ] 评审并安装最小依赖：`@neondatabase/serverless`、`zod`、`@node-rs/argon2`；如 CLI/test 需要执行 TypeScript，再增加 `tsx` dev dependency。
- [ ] 在 `package.json` 增加明确的 test、migration/CLI 脚本，所有远程脚本名称带环境意图，不提供默认 production target。
- [ ] 创建 `.env.example`，只放占位值：
  - `DATABASE_URL=postgresql://<runtime-user>:<password>@<host>-pooler/<db>?sslmode=require`
  - `DATABASE_URL_UNPOOLED=postgresql://<migration-user>:<password>@<host>/<db>?sslmode=require`
  - `AUTH_RATE_LIMIT_PEPPER=<random-secret>`
  - `CURSOR_SIGNING_SECRET=<random-secret>`
- [ ] 创建 `lib/db/env.ts`，服务端启动时验证缺失、空值、协议和 pooled/direct 用途；不得打印值。
- [ ] 创建 `lib/db/runtime.ts` 与 CLI-only direct entry；使用 `server-only` 防止进入客户端 bundle。
- [ ] 确认所有 auth/mutation Route Handlers 使用 Node runtime。

验证：

```bash
rtk pnpm lint
rtk pnpm exec tsc --noEmit
rtk pnpm build
rtk rg -n 'DATABASE_URL|AUTH_RATE_LIMIT_PEPPER|CURSOR_SIGNING_SECRET' --glob '!*.example' --glob '!pnpm-lock.yaml' .
```

完成定义：客户端 bundle 不可导入数据库模块；环境错误 fail fast 但不泄露 Secret；没有真实值进入仓库。

回滚点：恢复 `package.json`/lockfile，移除本 Phase 新增 db/env 模块；重新安装并运行基线质量门。

## 5. Phase 2：Baseline migration 与 SQL 验证

- [ ] 将任务内 [`schema.sql`](./schema.sql) 提升为 `db/migrations/0001_baseline.sql` 的一次性迁移；从此 migration 文件是实施代码的权威版本，任务副本保持评审记录。
- [ ] 配置 migration runner 只读取 `DATABASE_URL_UNPOOLED`，拒绝 hostname 带 `-pooler` 的 baseline DDL 运行。
- [ ] baseline 保持单一顶层 `DO` statement，可把完整 SQL 作为一次 `neon().query()`/prepared Query 发送；匿名块逐条动态执行 DDL，并依赖 statement 事务保证失败原子回滚。禁止额外拼接 `BEGIN`/`COMMIT` 或按普通分号 split，且必须使用具备 migration 权限的 direct connection。
- [ ] 在本地 disposable PostgreSQL 或经用户批准的隔离 Neon branch 执行 baseline；禁止直接指向生产。
- [ ] 验证 extension、schema、table、view、constraint、trigger 和 index。
- [ ] 添加 SQL integration tests，覆盖：
  - 第二账号被 singleton unique 拒绝；
  - 非法 slug/status/body/cover 被拒绝；
  - published 缺少关键字段被拒绝；
  - duplicate slug 被拒绝；
  - 首次发布后 slug 不可变；
  - update 自动递增 version；
  - `public_posts` 排除 draft/archived/deleted。
- [ ] 使用代表性数据运行核心查询 `EXPLAIN (ANALYZE, BUFFERS)`，确认索引路径；数据量太小时允许 planner 选择 seq scan，但需记录原因。

建议验证命令（只对 disposable database）：

```bash
rtk psql '<TEST_DATABASE_URL_UNPOOLED>' -v ON_ERROR_STOP=1 -f db/migrations/0001_baseline.sql
rtk psql '<TEST_DATABASE_URL_UNPOOLED>' -v ON_ERROR_STOP=1 -f db/tests/schema-contract.sql
```

完成定义：全新空库可一次执行成功；约束与 trigger 行为有可重复测试；未创建真实 production role/Secret。

回滚点：本地库/隔离 Neon branch 可整体丢弃；删除 Neon branch 属于远程 destructive action，执行前再次取得用户批准。不要用手工 `DROP TABLE` 模拟生产回滚。

## 6. Phase 3：数据库 repository adapter

- [ ] 抽取稳定 `ContentRepository` 接口，使页面继续只消费现有领域类型。
- [ ] 保留 `local-repository.ts` 作为迁移/回滚 adapter；新增 `neon-repository.ts`。
- [ ] 实现参数化已发布内容查询：site、posts、recent、post detail、archives、tags、tag posts、categories、category posts、search、stats、sidebar。
- [ ] 所有已发布文章 SQL 从 `blog.public_posts` 开始；调用前要求有效 session，未知 taxonomy 与合法空 taxonomy 分支分开。
- [ ] 在 adapter 中复用/保留当前 word count、reading minutes、TOC 和 previous/next 语义。
- [ ] Cursor 使用版本化 payload + HMAC 签名，绑定 endpoint、filter 和 sort；不得接受动态 SQL identifier。
- [ ] Search 对输入 NFKC/trim/lower，转义 LIKE wildcard，并与 title/taxonomy/excerpt 权重一致。
- [ ] 建立 row-to-domain validator；数据库 JSON 未验证前不能传给组件。
- [ ] 添加 local/neon contract tests，使用同一 fixture 比较 DTO 和排序。

验证：

```bash
rtk pnpm test
rtk pnpm lint
rtk pnpm exec tsc --noEmit
```

完成定义：所有现有 repository 方法在 Neon adapter 中有等价实现；local/neon fixture 对照通过；页面尚未被迫改 DTO。

回滚点：feature flag 保持 `local`；移除 Neon adapter 不影响现有页面。

## 7. Phase 4：当前切片——首次注册与全站保护

### 7.1 SQL 与认证 repository

- [ ] 更新 [`schema.sql`](./schema.sql) 的 rate-limit kind，使 login email 与单账号 registration global 预算相互隔离；保留 `singleton_key = 1` UNIQUE 约束。
- [ ] 在 runtime grant 模板中增加首次注册所需的 owner/profile/site 列级 INSERT；不授予 schema CREATE、账号 DELETE 或任意 DDL。
- [ ] 把 `lib/auth/repository.ts` 的登录限速查询改为显式 kind，增加 singleton existence 查询与 `registerOwnerWithSession`。
- [ ] `registerOwnerWithSession` 使用一个参数化数据修改 CTE/等价短事务：`owner_accounts` 采用 `ON CONFLICT (singleton_key) DO NOTHING`，其余 profile/site/session 只从成功插入的 owner CTE 写入；最终无 session row 即映射为 `REGISTRATION_CLOSED`。
- [ ] 抽取可复用的 session token/hash/expiry 生成逻辑，让 login 的 `insertSession` 与 register 原子写入共享同一 token 契约。

### 7.2 Service 与 Route Handler

- [ ] 在 `lib/auth/service.ts` 增加严格 `registerInputSchema`：email、password、passwordConfirmation，复用 CLI/登录的密码边界，确认字段不得入库或日志。
- [ ] 注册前先查询 singleton 以避免账号已存在时执行昂贵 hash；最终并发正确性仍由数据库 UNIQUE + CTE 保证。
- [ ] 注册使用 `AUTH_RATE_LIMIT_PEPPER` 对固定 registration scope 做 HMAC，形成全站单账号注册预算；登录继续按 normalized email 限速。
- [ ] 新增 `app/api/v1/auth/register/route.ts`，复用 Origin 校验、统一 response/problem envelope 和 session Cookie；成功返回 201，关闭返回 409，限速返回 429。
- [ ] 更新 login repository 的旧 `email` rate-limit kind 为 `login_email`，保持现有错误响应与防枚举行为。

### 7.3 页面边界与 UI

- [ ] 按 Next.js 16 route group 重组页面：`/login` 放入 `app/(auth)`；首页、account、about、archives、tags、categories、posts 放入 `app/(protected)`，URL 不变。
- [ ] 根 `app/layout.tsx` 只保留 html/body、全局 CSS、主题 boot 和不读取内容的基础视觉；现有 SiteHeader/SearchProvider/SiteFooter/FloatingTools 移入 protected layout。
- [ ] protected layout 在读取站点、搜索和统计数据前调用 `requireCurrentSession()`；无效 session 使用 `redirect('/login')`。
- [ ] 新增根 `proxy.ts`：缺 Cookie 的页面导航重定向 `/login`；排除 API、Next.js runtime、图片/字体/favicon 等静态资源；不访问 Neon、不承担授权。
- [ ] 内容 API 继续由 Route Handler 自己返回 JSON 401，Proxy 不把 API 重定向为 HTML。
- [ ] `/login` 页面增加登录/首次注册切换；注册成功与登录成功都 `router.replace('/account')`，已登录访问 `/login` 服务端跳转 `/account`。
- [ ] Header/移动 Drawer 在 protected shell 中显示账号入口；logout 成功后跳转 `/login`。
- [ ] `robots.ts` 禁止索引全站，`sitemap.ts` 不暴露受保护 URL；登录页保持 `noindex`。
- [ ] 更新 `db/README.md`：Web 首次注册成为默认初始化方式，CLI bootstrap 仍是可选离线方式，并显著提示无 setup secret 的抢注风险。
- [ ] 项目当前无 test script；为认证 service/repository/proxy 纯逻辑增加最小 Vitest 配置与 `pnpm test`，不引入与本切片无关的测试框架封装。

验证：

```bash
rtk pnpm test
rtk pnpm lint
rtk pnpm exec tsc --noEmit
rtk pnpm build
```

手工安全检查：

- [ ] Cookie 为 `HttpOnly; Secure; SameSite=Lax; Path=/`，生产使用 `__Host-` 前缀。
- [ ] 数据库只见 password hash 和 32-byte session hash。
- [ ] 注册只保存 password hash；passwordConfirmation 不进入 SQL、日志或响应。
- [ ] 第二次/并发注册为 `409 REGISTRATION_CLOSED`，无孤立 owner/profile/session。
- [ ] 登录错误、账号不存在和 disabled 响应一致。
- [ ] reset 后所有旧 Cookie 均为 401。
- [ ] 无 Cookie、伪造 Cookie、过期/撤销 Cookie 均不能访问业务页面；auth/static matcher 无重定向循环。
- [ ] 日志、audit、测试 snapshot 不含 password/token/connection string。

完成定义：唯一账号可通过 `/login` 首次注册或 CLI 初始化；注册成功即登录，后续注册关闭；所有业务页面与内容 API 需要数据库确认的有效 session，质量门与浏览器验收通过。

回滚点：回退 route group/proxy/auth UI 和 register Route Handler 到仅登录基线，但不得删除或覆盖已经创建的账号/session 数据，也不得通过回滚重新开放匿名内容。

## 8. Phase 5：API 基础设施与已发布内容读取（后续）

- [ ] 实现统一 success/error envelope、request ID、domain error mapping、cache header 和 `no-store` helper。
- [ ] 实现 query/body schema、limit/cursor 解析和字段错误格式。
- [ ] 按 [`api.md`](./api.md) 实现全部已发布内容 Route Handlers，并在读取前要求有效 session。
- [ ] API 只调用 application service/repository，不复制 SQL 或统计规则。
- [ ] 所有内容 GET 设置 `private, no-store`；验证任何内容都不进入公共 CDN cache。
- [ ] 加入逐 endpoint contract tests：方法、路径、参数、响应 shape、404/empty、cursor、503 清洗。

验证：

```bash
rtk pnpm test
rtk pnpm lint
rtk pnpm exec tsc --noEmit
rtk pnpm build
```

完成定义：`api.md` 的已发布内容接口全部有自动化契约测试；当前 repository 能力无遗漏；无 session 返回 401，数据库错误不会透传。

回滚点：移除 `app/api/v1` 内容路由不影响页面，因为页面直接调用 repository。

## 9. Phase 6：站长文章 CRUD、状态机与审计

- [ ] 实现 `OwnerPost` validators：草稿最小约束、完整发布约束和 `ContentBlock` 判别联合。
- [ ] 实现状态机并用 table-driven tests 覆盖所有合法/非法迁移。
- [ ] 实现 `POST /me/posts`：claim `Idempotency-Key`、create、audit、原响应持久化。
- [ ] 实现站长文章 list/detail/edit/soft-delete/restore。
- [ ] 实现 publish/withdraw/archive/unarchive action endpoints；普通 PATCH 禁止写状态时间戳。
- [ ] 所有 update 带 session `owner_id` 和客户端 `version`；404 与 409 分支稳定。
- [ ] 更新 post 与 tag relations、audit event 保持同一短事务。
- [ ] 发布后 slug 锁定；删除和恢复都回到 draft，避免意外公开。
- [ ] 实现 profile read/update 和 audit-event read endpoint。
- [ ] 写成功后失效精确 cache tags；写失败不执行 revalidation。

验证重点：

- [ ] 同一 create key 同 payload 不重复建文；不同 payload 为 409。
- [ ] 并发 PATCH 只有一个版本成功，另一个为 409。
- [ ] tag relation 失败时 post/audit 均回滚。
- [ ] publish 缺字段为 422；成功后仅持有效 session 的已发布内容读取可见。
- [ ] withdraw/archive/delete 后，认证读取立即 404；匿名请求始终为 401。
- [ ] restore 后仍为草稿，只有再次 publish 才公开。
- [ ] 每个成功写操作恰有一条 audit event，且不复制正文或 Secret。

完成定义：`api.md` 的站长、认证、状态和错误契约全部可重复验证。

回滚点：通过 server-only kill switch 暂停 mutation endpoints；不删除已写入数据。若 cache invalidation 不可靠，临时关闭跨请求 cache，而不是放宽认证或发布状态边界。

## 10. Phase 7：内容导入与页面切换

- [ ] 实现 `import-local-content`，使用 direct connection，把 site/author、taxonomy、posts 和 tag relations 原子导入；slug/日期保持不变。
- [ ] 导入前只接受空目标或显式 dry-run；重复导入行为必须清楚，不以无条件 upsert 覆盖线上内容。
- [ ] 比对 local/neon：6 篇文章、taxonomy count、年份、排序、DTO、搜索和前后篇；sitemap 继续不列出受保护 URL。
- [ ] 将 Server Components 的 repository source 切换到 Neon；保留 local feature flag 回退。
- [ ] 修改 post/tag/category 动态页：移除 `dynamicParams = false`，允许运行时新 slug；`generateStaticParams` 仅可用于预热。
- [ ] 接入认证边界内的 cache tags 和 mutation revalidation；metadata 与页面使用同一已发布内容查询，sitemap 不暴露内容 URL。
- [ ] 验证新发布文章无需 rebuild 即可访问，撤回后无需 rebuild 即 404。

验证：

```bash
rtk pnpm test
rtk pnpm lint
rtk pnpm exec tsc --noEmit
rtk pnpm build
```

完成定义：数据库切换前后登录后的 UI/URL/统计稳定；动态发布可见性符合状态机；local adapter 可一键回退读取。

回滚点：将 server-only content source 切回 local 并清理相关服务端 cache。不要回滚/覆盖已经通过写接口创建的 Neon 内容；恢复写入前先决定数据合并策略。

## 11. Phase 8：浏览器与安全验收

使用本地/隔离环境完整走查：

- [ ] 未登录访问 `/`、`/about`、`/archives`、taxonomy、post 和 `/account` 均跳转 `/login`，且没有受保护 shell/content 闪现。
- [ ] 未登录访问内容 API 返回 JSON 401；login/register API 与静态资源正常，不出现重定向循环。
- [ ] 首次注册成功设置 Cookie 并进入 `/account`；第二次和模拟并发注册稳定返回 `409 REGISTRATION_CLOSED`。
- [ ] 伪造、过期、撤销 session Cookie 均被 protected layout 拒绝；有效 Cookie 可访问原有 URL。
- [ ] 登录、刷新、退出、撤销 session、密码恢复后的旧 session 行为正确；logout 回到 `/login`。
- [ ] 已登录访问 `/login` 跳转 `/account`；robots/sitemap 不暴露可索引业务页面。
- [ ] 创建草稿不可出现在已发布内容搜索、详情、sitemap/stats。
- [ ] 编辑并发布后首页、详情、taxonomy、archives、search、stats、sidebar、metadata 和 sitemap 一致。
- [ ] 撤回、归档、删除后认证内容读取不再返回文章。
- [ ] 恢复为草稿，不自动公开。
- [ ] 两个浏览器窗口制造 version conflict，后写不会覆盖先写。
- [ ] 同源校验、Cookie flags、CORS 默认、错误清洗和 rate limit 符合契约。
- [ ] 在 `1440 × 900`、`1024 × 768`、`390 × 844` 检查登录/注册表单和登录后的现有页面无布局回归并保存截图。

质量命令：

```bash
rtk pnpm test
rtk pnpm lint
rtk pnpm exec tsc --noEmit
rtk pnpm build
```

优先运行 package 中的默认 `pnpm build`。若受限执行环境导致工具链失败，保留完整错误证据并在不改变产品行为的前提下运行最接近的替代命令；不能把替代命令结果宣称为默认 build 通过。

完成定义：PRD AC1–AC21 有文档审查、命令、API/SQL 测试或浏览器行为证据，未验证项明确列出。

## 12. Phase 9：部署与收尾

- [ ] 在隔离 Neon branch rehearsal migration/import/Web 注册/CLI bootstrap；用户批准后才对目标环境配置 Secret 或执行迁移。
- [ ] 创建最小权限 runtime role 与独立 migration role；runtime 不授予 schema CREATE，不使用 `neondb_owner`。
- [ ] 先部署 schema，再部署兼容旧/新数据源的应用，最后切换 feature flag；避免代码先于 schema。
- [ ] 记录 migration 版本、branch、部署 ID、验证结果和回退开关。
- [ ] 生产上线前另行确认 backup/PITR、告警、Secret rotation 和维护任务；这些不在当前文档任务完成范围。
- [ ] 运行 `trellis-check`，必要时更新 `.trellis/spec/`，再进入 `trellis-finish-work`。

删除 branch、清数据、修改 production Secret、部署或执行 production SQL 都属于外部/高风险操作，必须在实际执行前再次向用户申请明确授权。

## 13. AC 实施映射

| PRD AC | 实施 Phase | 主要证据 |
| --- | --- | --- |
| AC1 | 3、5、7 | repository/API contract tests |
| AC2 | 5、6 | endpoint method/path/query/status/code tests |
| AC2a | 4、6 | auth/owner/profile/audit tests |
| AC2b | 6 | 状态机 table tests + API integration |
| AC3 | 2 | empty DB migration output |
| AC4 | 2、3、7 | schema mapping + adapter parity |
| AC5 | 2、6 | constraint tests + application validation |
| AC6 | 2、3 | index inventory + query plans |
| AC7 | 1、2 | pooled/direct guards + connection tests |
| AC8 | 3、5 | 404/empty/cursor/503 contract tests |
| AC9 | 3、7 | local/neon DTO parity |
| AC10 | 所有 | 无真实 Neon 写入的文档任务证据；实施另行批准 |
| AC11 | 3、6 | parameterization/transaction/version/audit tests |
| AC12 | 2、4、6 | singleton constraint + anonymous/owner tests |
| AC13 | 4、8 | password/session/Cookie/rate-limit/security checks |
| AC14 | 2、4 | atomic registration + singleton concurrency tests |
| AC15 | 4、8 | `/login` 双模式 + protected route browser matrix |
| AC16 | 4、8 | register/login error and redirect tests |
| AC17 | 4、5、8 | protected layout + JSON 401 contract tests |
| AC18 | 4、8 | logout/bootstrap/reset lifecycle tests |
| AC19 | 4、8 | Proxy optimistic + authoritative session tests |
| AC20 | 2、4 | schema kind/grant/static SQL checks |
| AC21 | 4、8 | lint/typecheck/build/test + viewport screenshots |

## 14. 启动前最终检查

- [x] 五份规划/契约文件互不冲突，接口状态机与 SQL 约束一致。
- [x] 所有用户产品决策已解决，无未决占位或隐藏的多账号/管理后台范围。
- [x] 实施命令默认不指向 production，真实 Neon 操作均有独立批准门。
- [x] 每个 Phase 有完成定义、验证和回滚点。
- [x] 用户已看到本次最新规划摘要，并在后续消息中明确批准恢复实现。

最后一项完成前，本任务虽保持 `in_progress`，但不得修改产品代码；批准后直接继续 Phase 4，不重复运行 `task.py start`。
