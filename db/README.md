# Neon 登录功能初始化

当前实现不会自动连接或修改 Neon。首次使用时按以下顺序操作：

1. 在 disposable/local database 或已确认的 Neon branch 上，通过 direct connection 执行：

   ```bash
   rtk psql '<DATABASE_URL_UNPOOLED>' -v ON_ERROR_STOP=1 -f .trellis/tasks/08-18-neon-api-database-docs/schema.sql
   ```

2. 将 `.env.example` 复制为本地环境文件，并填写：

   - `DATABASE_URL`：Next.js runtime 使用的 `-pooler` 连接串；
   - `DATABASE_URL_UNPOOLED`：只给 migration/bootstrap/reset CLI 使用的 direct 连接串；
   - `APP_ORIGIN`：实际站点 Origin；
   - `AUTH_RATE_LIMIT_PEPPER`：独立生成、至少 32 字符的随机 Secret。

3. 交互式创建唯一站长账号：

   ```bash
   rtk pnpm auth:bootstrap
   ```

   密码不会通过 argv 传递或回显。若账号已存在，脚本会安全失败，不覆盖原账号。

4. 忘记密码时使用：

   ```bash
   rtk pnpm auth:reset-password
   ```

   密码更新和全部 session 撤销在同一数据库事务中完成。

5. 启动项目后访问 `/login`。登录成功跳转到 `/account`。

不要把真实连接串、密码或 pepper 写入源码、`.env.example`、日志或客户端环境变量。
