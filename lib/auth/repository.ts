import "server-only";

import { z } from "zod";

import { queryRows } from "@/lib/db/runtime";

const ownerRowSchema = z.object({
  id: z.uuid(),
  email: z.string(),
  passwordHash: z.string(),
  isEnabled: z.boolean(),
});

const sessionRowSchema = z.object({
  id: z.uuid(),
  accountId: z.uuid(),
  email: z.string(),
  createdAt: z.coerce.date(),
  expiresAt: z.coerce.date(),
});

const rateLimitRowSchema = z.object({
  blockedUntil: z.coerce.date().nullable(),
});

const ownerExistsRowSchema = z.object({
  exists: z.boolean(),
});

export type OwnerAccount = z.infer<typeof ownerRowSchema>;
export type OwnerSession = z.infer<typeof sessionRowSchema>;
export type AuthRateLimitKind = "login_email" | "register_global";

export type RegisterOwnerWithSessionInput = {
  email: string;
  passwordHash: string;
  displayName: string;
  siteUrl: string;
  tokenHashHex: string;
  expiresAt: Date;
};

function firstRow<T>(rows: unknown[], schema: z.ZodType<T>): T | null {
  const row = rows[0];
  return row === undefined ? null : schema.parse(row);
}

export async function findOwnerByEmail(email: string): Promise<OwnerAccount | null> {
  const rows = await queryRows(
    `
      SELECT
        id::text AS "id",
        email,
        password_hash AS "passwordHash",
        is_enabled AS "isEnabled"
      FROM blog.owner_accounts
      WHERE singleton_key = 1 AND email = $1
      LIMIT 1
    `,
    [email],
  );
  return firstRow(rows, ownerRowSchema);
}

export async function ownerAccountExists(): Promise<boolean> {
  const rows = await queryRows(
    `
      SELECT EXISTS (
        SELECT 1
        FROM blog.owner_accounts
        WHERE singleton_key = 1
      ) AS "exists"
    `,
  );
  return ownerExistsRowSchema.parse(rows[0]).exists;
}

export async function registerOwnerWithSession(
  input: RegisterOwnerWithSessionInput,
): Promise<OwnerSession | null> {
  const rows = await queryRows(
    `
      WITH inserted_owner AS (
        INSERT INTO blog.owner_accounts (email, password_hash)
        VALUES ($1, $2)
        ON CONFLICT (singleton_key) DO NOTHING
        RETURNING id, email
      ),
      inserted_profile AS (
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
        SELECT
          id,
          $3,
          '独立博客站长',
          '',
          '/images/brand/avatar.svg',
          '站长头像',
          240,
          240,
          '[]'::jsonb,
          '{}'::jsonb
        FROM inserted_owner
        RETURNING account_id
      ),
      inserted_site AS (
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
        SELECT
          1,
          '棱镜手记',
          '记录设计、代码与日常观察的独立博客。',
          $4,
          '/images/brand/logo.svg',
          '棱镜手记标志',
          96,
          96,
          '',
          '[]'::jsonb
        FROM inserted_owner
        ON CONFLICT (singleton_key) DO NOTHING
        RETURNING singleton_key
      ),
      inserted_session AS (
        INSERT INTO blog.auth_sessions (account_id, token_hash, expires_at)
        SELECT id, decode($5, 'hex'), $6
        FROM inserted_owner
        RETURNING id, account_id, created_at, expires_at
      )
      SELECT
        session.id::text AS "id",
        session.account_id::text AS "accountId",
        owner.email,
        session.created_at AS "createdAt",
        session.expires_at AS "expiresAt"
      FROM inserted_session AS session
      INNER JOIN inserted_owner AS owner ON owner.id = session.account_id
    `,
    [
      input.email,
      input.passwordHash,
      input.displayName,
      input.siteUrl,
      input.tokenHashHex,
      input.expiresAt.toISOString(),
    ],
  );
  return firstRow(rows, sessionRowSchema);
}

export async function findSessionByTokenHash(
  tokenHashHex: string,
): Promise<OwnerSession | null> {
  const rows = await queryRows(
    `
      SELECT
        sessions.id::text AS "id",
        sessions.account_id::text AS "accountId",
        accounts.email,
        sessions.created_at AS "createdAt",
        sessions.expires_at AS "expiresAt"
      FROM blog.auth_sessions AS sessions
      INNER JOIN blog.owner_accounts AS accounts ON accounts.id = sessions.account_id
      WHERE sessions.token_hash = decode($1, 'hex')
        AND sessions.revoked_at IS NULL
        AND sessions.expires_at > clock_timestamp()
        AND accounts.singleton_key = 1
        AND accounts.is_enabled = true
      LIMIT 1
    `,
    [tokenHashHex],
  );
  return firstRow(rows, sessionRowSchema);
}

export async function insertSession(
  accountId: string,
  tokenHashHex: string,
  expiresAt: Date,
): Promise<OwnerSession> {
  const rows = await queryRows(
    `
      INSERT INTO blog.auth_sessions (account_id, token_hash, expires_at)
      VALUES ($1, decode($2, 'hex'), $3)
      RETURNING
        id::text AS "id",
        account_id::text AS "accountId",
        (SELECT email FROM blog.owner_accounts WHERE id = account_id) AS "email",
        created_at AS "createdAt",
        expires_at AS "expiresAt"
    `,
    [accountId, tokenHashHex, expiresAt.toISOString()],
  );
  return sessionRowSchema.parse(rows[0]);
}

export async function revokeSession(sessionId: string): Promise<void> {
  await queryRows(
    `
      UPDATE blog.auth_sessions
      SET revoked_at = COALESCE(revoked_at, clock_timestamp())
      WHERE id = $1
    `,
    [sessionId],
  );
}

export async function getAuthRateLimit(
  kind: AuthRateLimitKind,
  keyHashHex: string,
): Promise<Date | null> {
  const rows = await queryRows(
    `
      SELECT blocked_until AS "blockedUntil"
      FROM blog.auth_rate_limits
      WHERE key_kind = $1 AND key_hash = decode($2, 'hex')
      LIMIT 1
    `,
    [kind, keyHashHex],
  );
  return firstRow(rows, rateLimitRowSchema)?.blockedUntil ?? null;
}

export async function recordAuthAttempt(
  kind: AuthRateLimitKind,
  keyHashHex: string,
): Promise<Date | null> {
  const rows = await queryRows(
    `
      INSERT INTO blog.auth_rate_limits (
        key_kind,
        key_hash,
        window_started_at,
        attempt_count,
        blocked_until,
        updated_at
      )
      VALUES ($1, decode($2, 'hex'), clock_timestamp(), 1, NULL, clock_timestamp())
      ON CONFLICT (key_kind, key_hash) DO UPDATE
      SET
        window_started_at = CASE
          WHEN blog.auth_rate_limits.window_started_at <= clock_timestamp() - interval '15 minutes'
            THEN clock_timestamp()
          ELSE blog.auth_rate_limits.window_started_at
        END,
        attempt_count = CASE
          WHEN blog.auth_rate_limits.window_started_at <= clock_timestamp() - interval '15 minutes'
            THEN 1
          ELSE blog.auth_rate_limits.attempt_count + 1
        END,
        blocked_until = CASE
          WHEN blog.auth_rate_limits.window_started_at <= clock_timestamp() - interval '15 minutes'
            THEN NULL
          WHEN blog.auth_rate_limits.attempt_count + 1 >= 5
            THEN clock_timestamp() + interval '15 minutes'
          ELSE blog.auth_rate_limits.blocked_until
        END,
        updated_at = clock_timestamp()
      RETURNING blocked_until AS "blockedUntil"
    `,
    [kind, keyHashHex],
  );
  return rateLimitRowSchema.parse(rows[0]).blockedUntil;
}

export async function resetAuthRateLimit(
  kind: AuthRateLimitKind,
  keyHashHex: string,
): Promise<void> {
  await queryRows(
    `
      UPDATE blog.auth_rate_limits
      SET
        window_started_at = clock_timestamp(),
        attempt_count = 0,
        blocked_until = NULL,
        updated_at = clock_timestamp()
      WHERE key_kind = $1 AND key_hash = decode($2, 'hex')
    `,
    [kind, keyHashHex],
  );
}
