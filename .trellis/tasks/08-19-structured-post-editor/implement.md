# 结构化文章编辑器实施计划

1. 运行 `trellis-before-dev`，读取现有 renderer、media client、forms、routes 和 Next.js 客户端边界。
2. 抽取可在 Server/Client 安全复用的纯 block renderer 与共享 DTO schemas。
3. 实现 new page 的 idempotency key 生命周期和 create→edit 跳转。
4. 建立 editor reducer、normalization、snapshot/dirty comparison 和 tests。
5. 实现 metadata、taxonomy create/select、cover upload。
6. 逐个实现 heading、paragraph inline、list、quote、image、code editors 和 block actions。
7. 实现桌面/移动 preview、键盘/focus 和错误定位。
8. 实现 manual save、success/error/request ID、409 conflict 与 draft export。
9. 实现 beforeunload 和全部编辑页导航守卫，增加浏览器 back/refresh 检查。
10. 实现所有状态 actions、确认 Dialog 和最近 audit。
11. 运行：

```bash
rtk pnpm test
rtk pnpm lint
rtk pnpm exec tsc --noEmit
rtk pnpm build
```

12. 浏览器完成 new→edit→save→publish→withdraw→archive→unarchive→delete→restore 闭环；用双窗口验证冲突，用 `390×844` 验证全部控件。
13. 运行 `trellis-check`，保存 AC1–AC10 证据。

回滚点：renderer 抽取先用回归测试锁定；block 类型逐个提交；UI 回滚不触碰已保存数据库内容。
