import {
  directSql,
  hashOwnerPassword,
  readNewPassword,
} from "./auth-cli.mjs";

async function main() {
  const password = await readNewPassword();
  const passwordHash = await hashOwnerPassword(password);
  const sql = directSql();

  const [accounts] = await sql.transaction((transaction) => [
    transaction.query(
      `
        UPDATE blog.owner_accounts
        SET
          password_hash = $1,
          password_changed_at = clock_timestamp()
        WHERE singleton_key = 1
        RETURNING id::text AS "id", email
      `,
      [passwordHash],
    ),
    transaction.query(
      `
        UPDATE blog.auth_sessions
        SET revoked_at = COALESCE(revoked_at, clock_timestamp())
        WHERE account_id = (
          SELECT id FROM blog.owner_accounts WHERE singleton_key = 1
        )
      `,
    ),
  ]);

  if (!accounts.length) {
    throw new Error("尚未创建站长账号，请先运行 auth:bootstrap");
  }
  process.stdout.write(`密码已更新并撤销全部 session：${accounts[0].email}\n`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "未知错误";
  process.stderr.write(`重置失败：${message}\n`);
  process.exitCode = 1;
});
