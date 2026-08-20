# 站长写接口 PRD

## 目标

补齐唯一站长管理站点、资料、session、taxonomy 和文章全生命周期所需的全部 `/api/v1` 写接口及审计能力。

## 需求

- 实现 session refresh/list/revoke/all revoke，当前 session 被撤销时清除 Cookie。
- 实现 `/me/site` 与 `/me/profile` GET/PATCH，使用共享 schema 和 `version`。
- 实现 `/me/categories`、`/me/tags` GET/POST，仅支持选择与创建。
- 实现 owner posts list/detail/create/update/soft-delete/restore。
- 实现 publish/withdraw/archive/unarchive action endpoints 和集中状态机。
- create 使用 `Idempotency-Key`；update/action 使用乐观并发。
- post、tag relations、idempotency 和 audit event 在同一原子写边界。
- mutation 全部校验 session、同源、owner、输入和版本，映射稳定错误 code。
- 实现 audit events cursor read API。

## 验收标准

- [ ] AC1：session 轮换后旧 token 立即失效，撤销当前/全部 session 会清除当前 Cookie。
- [ ] AC2：site/profile 更新不会修改登录凭据，版本过期返回 `VERSION_CONFLICT`。
- [ ] AC3：taxonomy 创建校验 name/slug，重复项返回稳定冲突，不提供删除接口。
- [ ] AC4：同一 idempotency key + 相同 payload 返回同一文章；不同 payload 返回冲突。
- [ ] AC5：所有合法/非法文章状态迁移有 table-driven tests。
- [ ] AC6：发布完整性、slug 冲突/锁定、version conflict、404/owner 边界稳定。
- [ ] AC7：每个成功写操作恰有一条不含正文/Secret 的 audit event，失败不留下部分写入。
- [ ] AC8：未认证、异源和非法输入不会写数据库，错误不泄露 SQL。
- [ ] AC9：test、lint、typecheck 和 build 通过。

## 不在范围

- 不实现管理 UI、编辑器、taxonomy 删除/合并或独立审计中心。
- 不执行真实 Neon 写入。

## 依赖

- `08-19-database-content-foundation` 必须完成；读取 API 子任务可并行评审但实现顺序保持在本任务之前。
