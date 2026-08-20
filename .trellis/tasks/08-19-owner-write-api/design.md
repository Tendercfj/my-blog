# 站长写接口设计

## 模块边界

- `lib/posts/schemas.ts`：draft/update/publish/ContentBlock schemas。
- `lib/posts/state-machine.ts`：唯一状态迁移表。
- `lib/posts/service.ts`：auth context 后的业务编排和 domain errors。
- `lib/posts/repository.ts`：owner-bound SQL 和短事务。
- `lib/site/*`：site/profile service/repository。
- `lib/taxonomy/*`：list/create 与 slug conflict。
- `lib/api/*`：共享 auth/origin/JSON/cursor/idempotency parsing。

Route Handlers 不包含 SQL 或第二套状态判断。

## 事务与并发

- password hashing、request parsing、R2 等网络工作不进入事务。
- create claim、post、tags、audit 和 stored response 属于一个原子边界。
- update/action 以 `WHERE id = ? AND owner_id = ? AND version = ?` 仲裁；零行再区分 404 与 conflict。
- action SQL 只执行状态机已允许的目标状态，并在同一事务写 audit。
- 不自动重试 PATCH/action；serialization/deadlock 如重试必须重放整个事务且有上限。

## 安全

所有 mutation 顺序为 request ID → origin → session → input → service。客户端 owner/status timestamps 被 schema 拒绝。审计只保存动作、版本和状态摘要。

## 回滚

提供 server-only mutation kill switch；关闭写接口不删除任何已写数据，读取能力保持可用。
