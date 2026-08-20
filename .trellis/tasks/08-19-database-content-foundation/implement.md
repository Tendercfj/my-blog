# 数据库与内容基础实施计划

1. 运行 `trellis-before-dev`，读取 Next.js/Neon/项目规范与现有 repository 调用链。
2. 记录 Git 和质量基线；确认没有真实数据库命令。
3. 引入最小测试运行器和 `pnpm test`，先锁定当前 local repository contract。
4. 提升 baseline migration 与增量约束，增加非远程 schema verification。
5. 抽取 port、local adapter、source selector 和 production guard。
6. 建立 row/JSON decoders，复用现有派生函数。
7. 实现全部 Neon read queries 与 local/Neon contract tests。
8. 实现 import dry-run/report、`--apply` preflight 和单事务写入。
9. 更新 `.env.example`、README/db docs，不包含真实值。
10. 运行：

```bash
rtk pnpm test
rtk pnpm lint
rtk pnpm exec tsc --noEmit
rtk pnpm build
rtk rg -n 'BLOG_CONTENT_SOURCE|DATABASE_URL|DATABASE_URL_UNPOOLED' .env.example README.md db lib scripts
```

11. 运行 `trellis-check`，保存 AC1–AC7 证据。

回滚点：每一步都保持 local adapter contract 通过；导入脚本在没有 `--apply` 时绝不写入。
