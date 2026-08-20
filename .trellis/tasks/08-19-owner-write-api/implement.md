# 站长写接口实施计划

1. 运行 `trellis-before-dev`，读取 auth、DB、API、schema 和父设计。
2. 先补共享 request/auth/origin/idempotency/cursor 测试 helpers。
3. 实现 session refresh/list/revoke/all revoke 及 Cookie 行为。
4. 实现 site/profile schemas、repository、service、GET/PATCH 和 version tests。
5. 实现 taxonomy list/create 和冲突 tests。
6. 建立 OwnerPost DTO、ContentBlock schema、draft/update/publish validators。
7. 建立集中状态机和 table-driven tests。
8. 实现 create/list/detail/PATCH/delete/restore。
9. 实现 publish/withdraw/archive/unarchive。
10. 实现 idempotency result 与 audit cursor API，验证事务原子性。
11. 检查所有 endpoints 的 session/origin/error/no-store。
12. 运行：

```bash
rtk pnpm test
rtk pnpm lint
rtk pnpm exec tsc --noEmit
rtk pnpm build
```

13. 运行 `trellis-check`，逐项保存 AC1–AC9 证据。

回滚点：按 session、site/profile、taxonomy、post CRUD、actions 五个边界保留检查点；必要时只关闭 mutation，不做 destructive 数据回滚。
