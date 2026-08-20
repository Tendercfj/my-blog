# 完整博客接口与管理 UI 父任务实施计划

## 1. 执行模型

本任务是父任务，只负责统一需求、跨层契约、子任务顺序和最终集成验收。产品代码通过 6 个子任务逐个实施，禁止把全部范围压成一次无检查点的大改。

顺序如下：

1. `08-19-database-content-foundation`
2. `08-19-content-read-api-pages`
3. `08-19-owner-write-api`
4. `08-19-account-management-ui`
5. `08-19-structured-post-editor`
6. `08-19-full-stack-integration-check`

每个子任务开始前必须通过自己的规划校验；每个子任务完成 lint、typecheck、test、build 和对应专项验收后，才能启动下一个。

## 2. 父任务启动门

- [ ] 用户已批准最新父任务规划摘要以及 6 个子任务范围。
- [ ] `prd.md`、`design.md`、本文件和所有子任务规划无冲突。
- [ ] `implement.jsonl` / `check.jsonl` 只有真实 spec/research 条目。
- [ ] 运行：

```bash
rtk python3 ./.trellis/scripts/task.py validate 08-19-blog-api-ui-completion
rtk python3 ./.trellis/scripts/task.py start 08-19-blog-api-ui-completion
```

- [ ] 记录父任务启动时的 Git 分支、工作树和基线命令：

```bash
rtk git status --short
rtk pnpm lint
rtk pnpm exec tsc --noEmit
rtk pnpm build
```

若基线失败，先记录并归属既有问题；不把既有失败归为后续子任务引入。

## 3. 子任务 1：数据库与内容基础

- [ ] 提升并验证 baseline migration，不执行真实远程数据库。
- [ ] 增加显式 `BLOG_CONTENT_SOURCE` 与 production guard。
- [ ] 抽取 repository ports、local adapter、Neon adapter、row decoders 和共享派生。
- [ ] 增加 local content import CLI，落实 dry-run、`--apply`、空内容库、单事务和不覆盖 owner。
- [ ] 建立最小测试运行器、domain tests、repository contract tests 和 SQL verification 入口。

进入下阶段条件：local adapter 回归通过；Neon adapter 的参数化查询、解码和错误语义有自动化证据；导入默认不写数据。

## 4. 子任务 2：内容读取接口与展示页

- [ ] 按 `api.md` 实现 11 组内容读取 Route Handlers。
- [ ] 统一 session guard、query/cursor schema、envelope、request ID 和 no-store。
- [ ] 将 8 个展示页逐页切换到 service/repository，移除 runtime 新 slug 的静态封锁。
- [ ] 验证 metadata、404、合法空 taxonomy、search、sidebar 和统计。
- [ ] 完成三档视口展示页回归。

进入下阶段条件：所有读取 endpoints 具有 contract tests；8 个展示页不直接读取 `content/*.ts`；local/neon DTO 一致。

## 5. 子任务 3：站长写接口

- [ ] 补齐 session refresh/list/revoke/all revoke。
- [ ] 实现 site/profile read-update 与 version conflict。
- [ ] 实现 taxonomy list-create。
- [ ] 实现 owner posts CRUD、状态 action、idempotency、审计和状态机测试。
- [ ] 确认每个成功写操作的 post/tag/audit 原子性和稳定错误映射。

进入下阶段条件：全部写接口 contract tests 通过；未认证/异源/跨版本/非法状态路径均有证据。

## 6. 子任务 4：账号管理 UI

- [ ] `/account` 工作台。
- [ ] `/account/profile` 站点、作者和 about 设置。
- [ ] `/account/security` session 列表、单个撤销和全部退出。
- [ ] `/account/posts` 状态筛选、cursor pagination、搜索和回收站。
- [ ] 浏览器验证 pending/error/empty/focus/mobile。

进入下阶段条件：站长不依赖 curl 即可管理资料、session 和进入任意文章工作流。

## 7. 子任务 5：结构化文章编辑器

- [ ] 新建草稿与幂等创建。
- [ ] 元数据、taxonomy、cover 上传。
- [ ] 全部 ContentBlock 编辑和复用 renderer 的 preview。
- [ ] 手动保存、dirty comparison、离开保护、field error、version conflict。
- [ ] publish/withdraw/archive/unarchive/delete/restore 与文章最近审计。
- [ ] 桌面、平板和移动端完整走查。

进入下阶段条件：唯一站长可从空草稿完成创建、编辑、发布、撤回、归档、删除、恢复闭环；冲突不会静默覆盖。

## 8. 子任务 6：全栈集成验收

- [ ] 在 local adapter 完成离线全链路测试。
- [ ] 若用户另行批准隔离 Neon，再执行 migration/import/SQL/Neon contract tests；否则明确记录未执行。
- [ ] 逐页、逐接口、逐状态核对父任务 AC。
- [ ] 运行安全检查、Secret 扫描、内容源检查和浏览器 Network 检查。
- [ ] 运行最终质量门：

```bash
rtk pnpm test
rtk pnpm lint
rtk pnpm exec tsc --noEmit
rtk pnpm build
```

- [ ] 运行 `trellis-check`，处理真实发现。
- [ ] 按 `trellis-update-spec` 记录已经由代码验证的稳定项目约定。

完成定义：父 PRD 的 AC1–AC15 全部有命令、测试、数据库或浏览器证据；未获批准的真实 Neon 操作不被伪装成已验证。

## 9. 持续检查规则

每个子任务内至少运行：

```bash
rtk pnpm test
rtk pnpm lint
rtk pnpm exec tsc --noEmit
rtk pnpm build
```

- 一个质量门失败时暂停新增范围，先修复或确认既有归属。
- 前端 UI 变更必须通过浏览器检查和截图，不能只依赖 build。
- 数据库写路径必须验证 rollback、duplicate、conflict 和 unauthorized。
- 所有 CRITICAL/WARNING 审查意见必须回到实际调用链验证，不能直接照单修改。

## 10. 总体回滚点

- 子任务 1：保持 local adapter，撤回未启用的 Neon adapter/migration runner。
- 子任务 2：开发环境显式切回 local；生产不允许 local fallback。
- 子任务 3：启用 server-only mutation kill switch；不删除已经写入的数据。
- 子任务 4–5：按 route/component 边界回退 UI；数据库和 API 保持向后兼容。
- 子任务 6：只修集成缺口，不在验收阶段重写架构；发现设计缺陷时回滚到对应子任务重新规划。

任何删除文件、删除数据库/branch、远程 migration、Secret 或生产操作都必须再次取得用户批准。
