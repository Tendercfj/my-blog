import { randomUUID } from "node:crypto";

import {
  directSql,
  errorCode,
  hashOwnerPassword,
  readEmail,
  readNewPassword,
} from "./auth-cli.mjs";

async function main() {
  const email = await readEmail();
  const password = await readNewPassword();
  const passwordHash = await hashOwnerPassword(password);
  const accountId = randomUUID();
  const displayName = email.split("@")[0] || "站长";
  const sql = directSql();

  await sql.transaction((transaction) => [
    transaction.query(
      `
        INSERT INTO blog.owner_accounts (id, email, password_hash)
        VALUES ($1, $2, $3)
      `,
      [accountId, email, passwordHash],
    ),
    transaction.query(
      `
        INSERT INTO blog.author_profiles (
          account_id,
          name,
          role,
          bio,
          avatar_src,
          avatar_alt,
          avatar_width,
          avatar_height,
          links,
          about
        )
        VALUES (
          $1,
          $2,
          '独立博客站长',
          '',
          '/images/brand/avatar.svg',
          '站长头像',
          240,
          240,
          '[]'::jsonb,
          '{}'::jsonb
        )
      `,
      [accountId, displayName],
    ),
    transaction.query(
      `
        INSERT INTO blog.site_settings (
          singleton_key,
          name,
          description,
          site_url,
          logo_src,
          logo_alt,
          logo_width,
          logo_height,
          announcement,
          navigation
        )
        VALUES (
          1,
          '棱镜手记',
          '记录设计、代码与日常观察的独立博客。',
          $1,
          '/images/brand/logo.svg',
          '棱镜手记标志',
          96,
          96,
          '',
          '[]'::jsonb
        )
        ON CONFLICT (singleton_key) DO NOTHING
      `,
      [process.env.APP_ORIGIN?.trim() || "http://localhost:3000"],
    ),
  ]);

  process.stdout.write(`站长账号创建成功：${email}\n`);
}

main().catch((error) => {
  if (errorCode(error) === "23505") {
    process.stderr.write("站长账号已存在，bootstrap 不会覆盖现有凭据。\n");
  } else {
    const message = error instanceof Error ? error.message : "未知错误";
    process.stderr.write(`创建失败：${message}\n`);
  }
  process.exitCode = 1;
});
