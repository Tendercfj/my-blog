# Neon 登录与首次注册初始化

当前实现不会自动连接或修改 Neon。首次使用时按以下顺序操作：

1. 在 disposable/local database 或已确认的 Neon branch 上，通过 migration 权限的 direct connection 执行。`schema.sql` 是单一顶层 `DO` statement，可以把完整文件作为一次 prepared Query 发送：

   ```ts
   import { readFile } from "node:fs/promises";
   import { neon } from "@neondatabase/serverless";

   const schema = await readFile(
     ".trellis/tasks/08-18-neon-api-database-docs/schema.sql",
     "utf8",
   );
   const sql = neon(process.env.DATABASE_URL_UNPOOLED!);

   await sql.query(schema, []);
   ```

   不要给 query text 额外拼接 `BEGIN`/`COMMIT`，也不要按分号切割。文件内的每个 DDL command 由匿名块分别执行，但客户端只提交一个 statement；任一 command 失败时，同一 `DO` statement 中已完成的 DDL 会随事务整体回滚。

   这仍是 migration，不应通过应用的 pooled runtime role 或 `lib/db/runtime.ts` 执行：runtime role 没有 extension/schema/table 的 DDL 权限。执行前确认目标是空的 disposable/local database 或隔离 Neon branch；不要连接 production。

   提交前也可以运行静态回归，确认文件仍是一个 prepared Query statement：

   ```bash
   rtk pnpm schema:verify
   ```

   如果旧版多 command 文件曾返回 `cannot insert multiple commands into a prepared statement`，PostgreSQL 通常是在执行任何 command 前拒绝它。可先用只读查询确认：

   ```sql
   SELECT tablename
   FROM pg_catalog.pg_tables
   WHERE schemaname = 'blog'
   ORDER BY tablename;
   ```

   若已经手动逐条执行过一部分 command，不要直接重跑 baseline；先记录已存在对象，并在 disposable branch 重建或另行制定迁移方案。

2. 将 `.env.example` 复制为本地环境文件，并填写：

   - `DATABASE_URL`：Next.js runtime 使用的 `-pooler` 连接串；
   - `DATABASE_URL_UNPOOLED`：只给 migration/bootstrap/reset CLI 使用的 direct 连接串；
   - `APP_ORIGIN`：实际站点 Origin；
   - `AUTH_RATE_LIMIT_PEPPER`：独立生成、至少 32 字符的随机 Secret。

3. 本地开发由 Next.js 自动读取 `.env`。应用的登录、注册和 session 查询全部通过 `@neondatabase/serverless` 使用 `DATABASE_URL`；不会在运行时读取 `DATABASE_URL_UNPOOLED`。

4. 启动项目并访问 `/login`，切换到“首次注册”创建唯一站长账号。注册成功后会同时创建默认 profile、缺失的 site settings 和首个 session，并跳转 `/account`。

   首次注册不使用 setup secret、邀请码或邮件验证。请在部署后立即完成注册；账号表一旦存在记录，后续注册会返回 `409 REGISTRATION_CLOSED`，不会覆盖账号。

5. 若不希望通过 Web 首次注册，也可以在账号尚未创建时使用交互式 CLI：

   ```bash
   rtk pnpm auth:bootstrap
   ```

   密码不会通过 argv 传递或回显。若账号已存在，脚本会安全失败，不覆盖原账号。

6. 忘记密码时使用：

   ```bash
   rtk pnpm auth:reset-password
   ```

   密码更新和全部 session 撤销在同一数据库事务中完成。

7. 登录成功后所有业务页面可见；无 session 访问首页、文章、归档、标签、分类、关于页或账号页时会跳转 `/login`。伪造、过期或已撤销的 Cookie 会由服务端数据库 session 校验拒绝。

## R2 图片 URL

现有 schema 的头像和文章封面字段默认只接受 `/images/`。使用 R2 custom domain 前，通过 direct connection 放宽这两个约束；该 migration 不创建新表：

```bash
rtk psql '<DATABASE_URL_UNPOOLED>' -v ON_ERROR_STOP=1 -f db/migrations/0002_r2_image_urls.sql
```

完成后，`author_profiles.avatar_src` 和 `posts.cover_src` 可以保存 `/images/...` 或 `https://assets.tendercfj.cc.cd/...`。migration 应先在 disposable/local database 或已确认的 Neon branch 上验证，不要从浏览器或 Next.js runtime 自动执行。

不要把真实连接串、密码或 pepper 写入源码、`.env.example`、日志或客户端环境变量。
