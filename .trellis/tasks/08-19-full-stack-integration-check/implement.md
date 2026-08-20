# 全栈集成验收实施计划

1. 运行 `trellis-before-dev` 与 `trellis-check` 基线，读取父/子任务 AC。
2. 生成 endpoint、page、state、error code 实际清单并与文档 diff。
3. 运行 domain/repository/Route Handler/component 全部自动化测试。
4. 在授权范围内运行 migration/schema/import tests，记录环境与命令。
5. 使用 local/disposable 数据完成注册、登录、session、内容读取、profile/site、taxonomy、文章全生命周期和审计闭环。
6. 使用浏览器逐页检查展示页和管理页：
   - `1440×900`
   - `1024×768`
   - `390×844`
   - 浅/深主题
   - keyboard/focus/reduced-motion
7. 用双窗口制造 version conflict；重复 create 验证 idempotency；错误注入验证 401/403/404/409/422/503。
8. 运行静态安全检查和 Network 检查，确认无内部 HTTP、自动 fallback、远程热链或 Secret。
9. 运行最终命令：

```bash
rtk pnpm test
rtk pnpm lint
rtk pnpm exec tsc --noEmit
rtk pnpm build
rtk git status --short
```

10. 运行 `trellis-check`；只修验证后的真实问题，并重复受影响矩阵。
11. 使用 `trellis-update-spec` 记录已经由代码证明的稳定约定。
12. 汇总 Done、Verified、Not Done、Risks、Next Steps；真实 Neon 未获批时明确保留该风险。

回滚点：每个缺陷修复只在拥有层内进行；最终验收不删除数据库或远程资源。
