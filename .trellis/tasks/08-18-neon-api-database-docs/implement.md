# 单账号个人博客 Neon 接入实施计划

## 1. 计划边界

本文件描述完整 Neon 接入顺序。用户已在 2026-08-18 批准先实现登录认证切片；当前仍不执行以下操作：

- 不创建/修改真实 Neon branch、database、role 或 Secret；
- 不执行本任务 SQL；
- 不实现公开内容 Neon adapter、文章 CRUD/action Route Handlers 或文章编辑 UI；
- 不把现有本地内容切换到数据库。

后续实施应先建立可回滚的读取链路，再开放认证和写入。当前根目录不是 Git 仓库，开始任何产品代码修改前必须额外记录文件级检查点；若用户后续初始化 Git，则优先使用小提交作为回滚点。

## 2. 实施目标

- 使用 Neon PostgreSQL 替换当前 local content repository 的事实来源，同时保持页面领域 DTO。
- 提供单账号登录、session 管理和站长本人文章 CRUD/action API。
- 文章支持草稿、发布、撤回、归档、撤销归档、软删除和恢复。
- 公开页面、API、metadata、search、stats 和 sitemap 只看公开文章。
- 运行时 pooled、migration/CLI direct，全部 SQL 参数化且不依赖 session 状态。

## 3. Phase 0：启动门与基线

- [ ] 用户评审最新 `prd.md`、`api.md`、`schema.sql`、`design.md`、`implement.md` 并明确批准实施。
- [ ] 运行 Trellis `task.py start`，确认 task 状态由 `planning` 变为 `in_progress`。
- [ ] 读取 `trellis-before-dev` 和 `.trellis/spec/` 对应规范。
- [ ] 记录根目录无 Git、当前文件清单、`package.json`、lockfile、repository、动态路由与环境文件基线。
- [ ] 检查工作区现有修改，避免覆盖父任务未提交成果。
- [ ] 运行当前质量基线并保存输出：

```bash
rtk pnpm lint
rtk pnpm exec tsc --noEmit
rtk pnpm exec next build --webpack
```

完成定义：规划已获最新批准；基线命令结果和现有环境限制有记录；尚未接触真实 Neon。

回滚点：无产品文件修改，只需保持任务为未实施状态。不得在本阶段运行远程 SQL。

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
rtk pnpm exec next build --webpack
rtk rg -n 'DATABASE_URL|AUTH_RATE_LIMIT_PEPPER|CURSOR_SIGNING_SECRET' --glob '!*.example' --glob '!pnpm-lock.yaml' .
```

完成定义：客户端 bundle 不可导入数据库模块；环境错误 fail fast 但不泄露 Secret；没有真实值进入仓库。

回滚点：恢复 `package.json`/lockfile，移除本 Phase 新增 db/env 模块；重新安装并运行基线质量门。

## 5. Phase 2：Baseline migration 与 SQL 验证

- [ ] 将任务内 [`schema.sql`](./schema.sql) 提升为 `db/migrations/0001_baseline.sql` 的一次性迁移；从此 migration 文件是实施代码的权威版本，任务副本保持评审记录。
- [ ] 配置 migration runner 只读取 `DATABASE_URL_UNPOOLED`，拒绝 hostname 带 `-pooler` 的 baseline DDL 运行。
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
- [ ] 实现参数化公开查询：site、posts、recent、post detail、archives、tags、tag posts、categories、category posts、search、stats、sidebar。
- [ ] 所有公开文章 SQL 从 `blog.public_posts` 开始；未知 taxonomy 与合法空 taxonomy 分支分开。
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

## 7. Phase 4：认证、bootstrap 与 session

- [ ] 实现 Argon2id password helper；目标参数通过部署环境 benchmark 固化并记录。
- [ ] 实现 `bootstrap-owner`：隐藏密码输入、normalized email、direct connection、重复执行失败、原子创建账号/profile/site singleton。
- [ ] 实现 `reset-owner-password`：direct connection、原子更新 hash + revoke all sessions；不从 argv 接收密码。
- [ ] 实现 session token 生成、SHA-256 hash、Cookie 设置/清除、绝对过期、轮换、撤销和节流 last-seen。
- [ ] 实现数据库限速：email/IP 使用 secret pepper 的 HMAC key；仅信任已配置的代理 IP 来源。
- [ ] 实现 Origin/Host 校验和 `requireOwnerSession`；受保护接口不依赖前端隐藏。
- [ ] 实现 `/auth/login`、refresh、logout、me、sessions list/revoke。
- [ ] 认证错误统一，防止通过时间或响应内容枚举账号。

验证：

```bash
rtk pnpm test
rtk pnpm lint
rtk pnpm exec tsc --noEmit
```

手工安全检查：

- [ ] Cookie 为 `HttpOnly; Secure; SameSite=Lax; Path=/`，生产使用 `__Host-` 前缀。
- [ ] 数据库只见 password hash 和 32-byte session hash。
- [ ] 登录错误、账号不存在和 disabled 响应一致。
- [ ] reset 后所有旧 Cookie 均为 401。
- [ ] 日志、audit、测试 snapshot 不含 password/token/connection string。

完成定义：唯一账号可通过 CLI 初始化/恢复；无注册/找回端点；session 生命周期和限速测试通过。

回滚点：禁用 auth Route Handlers 和 owner mutation；公开 local repository 保持工作。已创建的账号数据不通过代码回滚删除。

## 8. Phase 5：API 基础设施与公开读取

- [ ] 实现统一 success/error envelope、request ID、domain error mapping、cache header 和 `no-store` helper。
- [ ] 实现 query/body schema、limit/cursor 解析和字段错误格式。
- [ ] 按 [`api.md`](./api.md) 实现全部公开读取 Route Handlers。
- [ ] API 只调用 application service/repository，不复制 SQL 或统计规则。
- [ ] 对公开 GET 设置 ETag/HTTP cache；验证草稿/受保护数据永不进入 public cache。
- [ ] 加入逐 endpoint contract tests：方法、路径、参数、响应 shape、404/empty、cursor、503 清洗。

验证：

```bash
rtk pnpm test
rtk pnpm lint
rtk pnpm exec tsc --noEmit
rtk pnpm exec next build --webpack
```

完成定义：`api.md` 的公开接口全部有自动化契约测试；当前 repository 能力无遗漏；数据库错误不会透传。

回滚点：移除 `app/api/v1` 公开路由不影响页面，因为页面直接调用 repository。

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
- [ ] publish 缺字段为 422；成功后匿名可读。
- [ ] withdraw/archive/delete 后匿名立即 404。
- [ ] restore 后仍为草稿，只有再次 publish 才公开。
- [ ] 每个成功写操作恰有一条 audit event，且不复制正文或 Secret。

完成定义：`api.md` 的站长、认证、状态和错误契约全部可重复验证。

回滚点：通过 server-only kill switch 暂停 mutation endpoints；不删除已写入数据。若 cache invalidation 不可靠，临时关闭公开持久 cache 而不是重新暴露非公开文章。

## 10. Phase 7：内容导入与页面切换

- [ ] 实现 `import-local-content`，使用 direct connection，把 site/author、taxonomy、posts 和 tag relations 原子导入；slug/日期保持不变。
- [ ] 导入前只接受空目标或显式 dry-run；重复导入行为必须清楚，不以无条件 upsert 覆盖线上内容。
- [ ] 比对 local/neon：6 篇文章、taxonomy count、年份、排序、DTO、搜索、前后篇和 sitemap URL。
- [ ] 将 Server Components 的 repository source 切换到 Neon；保留 local feature flag 回退。
- [ ] 修改 post/tag/category 动态页：移除 `dynamicParams = false`，允许运行时新 slug；`generateStaticParams` 仅可用于预热。
- [ ] 接入公开 cache tags 和 mutation revalidation；sitemap/metadata 与页面使用同一公开查询。
- [ ] 验证新发布文章无需 rebuild 即可访问，撤回后无需 rebuild 即 404。

验证：

```bash
rtk pnpm test
rtk pnpm lint
rtk pnpm exec tsc --noEmit
rtk pnpm exec next build --webpack
```

完成定义：数据库切换前后公开 UI/URL/统计稳定；动态发布可见性符合状态机；local adapter 可一键回退读取。

回滚点：将 server-only content source 切回 local 并清 public cache。不要回滚/覆盖已经通过写接口创建的 Neon 内容；恢复写入前先决定数据合并策略。

## 11. Phase 8：浏览器与安全验收

使用本地/隔离环境完整走查：

- [ ] 未登录访问所有 `/me/**` 为 401，页面公开读取正常。
- [ ] 登录、刷新、退出、撤销 session、密码恢复后的旧 session 行为正确。
- [ ] 创建草稿不可公开搜索/访问/出现在 sitemap/stats。
- [ ] 编辑并发布后首页、详情、taxonomy、archives、search、stats、sidebar、metadata 和 sitemap 一致。
- [ ] 撤回、归档、删除后公开缓存不再返回文章。
- [ ] 恢复为草稿，不自动公开。
- [ ] 两个浏览器窗口制造 version conflict，后写不会覆盖先写。
- [ ] 同源校验、Cookie flags、CORS 默认、错误清洗和 rate limit 符合契约。
- [ ] 三档视口检查现有公开页面没有因动态数据接入发生布局回归。

质量命令：

```bash
rtk pnpm test
rtk pnpm lint
rtk pnpm exec tsc --noEmit
rtk pnpm exec next build --webpack
```

若默认 Turbopack build 在当前受限执行环境仍因 PostCSS 子进程绑定端口失败，保留完整错误证据并继续用 `--webpack` 验证代码；不能把环境失败宣称为默认 build 通过。

完成定义：PRD AC1–AC14 有命令、API 测试、SQL 测试或浏览器行为证据，未验证项明确列出。

## 12. Phase 9：部署与收尾

- [ ] 在隔离 Neon branch rehearsal migration/import/bootstrap；用户批准后才对目标环境配置 Secret 或执行迁移。
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
| AC14 | 4 | bootstrap duplicate failure + reset revocation tests |

## 14. 启动前最终检查

- [x] 五份规划/契约文件互不冲突，接口状态机与 SQL 约束一致。
- [x] 所有用户产品决策已解决，无未决占位或隐藏的多账号/管理后台范围。
- [x] 实施命令默认不指向 production，真实 Neon 操作均有独立批准门。
- [x] 每个 Phase 有完成定义、验证和回滚点。
- [ ] 用户已看到本次最新规划摘要，并在后续消息中明确批准开始实现。

最后一项完成前，本任务保持 `planning`，不得运行 `task.py start`。
