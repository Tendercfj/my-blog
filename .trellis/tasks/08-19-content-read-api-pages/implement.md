# 内容读取接口与展示页实施计划

1. 运行 `trellis-before-dev`，读取已安装 Next.js Route Handler/data 文档和父任务契约。
2. 建立 API query/cursor/session 测试 helpers，先锁定现有 envelope。
3. 实现 `/site`、`/posts`、`/posts/[slug]`，验证分页、featured 和 404。
4. 实现 archives、tags/categories 总览与详情，验证合法空 taxonomy。
5. 实现 search、stats、sidebar，验证排序、limit 和派生一致性。
6. 逐页迁移首页、文章详情、归档、taxonomy、about；保持 Server Components。
7. 调整动态 slug 和 metadata 读取，确认新 slug 无需 rebuild。
8. 运行自动化质量门：

```bash
rtk pnpm test
rtk pnpm lint
rtk pnpm exec tsc --noEmit
rtk pnpm build
rtk rg -n 'content/(site|posts)' app components
```

9. 启动本地服务，逐页验证 `1440×900`、`1024×768`、`390×844`，检查 Network、404、empty、搜索和无横向溢出。
10. 运行 `trellis-check` 并保存 AC1–AC7 证据。

回滚点：每完成一组 endpoints/page 后保留独立检查点；不以自动 local fallback 修复数据库错误。
