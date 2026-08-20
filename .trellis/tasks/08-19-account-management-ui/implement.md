# 账号管理 UI 实施计划

1. 运行 `trellis-before-dev`，读取现有 layout、account、forms、Base UI 和 Next.js 16 docs。
2. 建立共享 account layout/nav、API client 和 UI state primitives。
3. 实现 `/account` 工作台与真实统计/最近文章。
4. 实现 `/account/profile` 的 site/profile/links/about/头像上传与版本冲突。
5. 实现 `/account/security` session 列表、单个撤销、全部退出。
6. 实现 `/account/posts` URL-driven filters、search、cursor、空状态、回收站和入口。
7. 添加组件/domain tests，避免依赖真实 Neon。
8. 运行：

```bash
rtk pnpm test
rtk pnpm lint
rtk pnpm exec tsc --noEmit
rtk pnpm build
```

9. 浏览器验证 4 个页面在 `1440×900`、`1024×768`、`390×844` 的加载、错误、空状态、键盘、focus、确认和无溢出，并截图。
10. 运行 `trellis-check`，保存 AC1–AC7 证据。

回滚点：按 route 独立回退；不修改写 API 契约。
