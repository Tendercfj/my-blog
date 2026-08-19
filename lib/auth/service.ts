import "server-only";

import { createHmac } from "node:crypto";

import type { z } from "zod";

import { ApiProblem } from "@/lib/api/problem";
import {
  findOwnerByEmail,
  getAuthRateLimit,
  ownerAccountExists,
  recordAuthAttempt,
  registerOwnerWithSession,
  resetAuthRateLimit,
} from "@/lib/auth/repository";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { createSessionMaterial, issueSession } from "@/lib/auth/session";
import {
  loginInputSchema,
  normalizeOwnerEmail,
  registerInputSchema,
} from "@/lib/auth/validation";

const dummyPasswordHash =
  "$argon2id$v=19$m=19456,t=2,p=1$FbudMBkkDLlmSFklU/kPpg$kYsPIzK1iMkO7kUuwnMQ137QxCNb/9Q13XcOBT2Sa1Y";

function rateLimitKey(scope: string): string {
  const pepper = process.env.AUTH_RATE_LIMIT_PEPPER?.trim();
  if (!pepper || pepper.length < 32) {
    throw new ApiProblem(503, "AUTH_NOT_CONFIGURED", "登录服务尚未完成安全配置");
  }
  return createHmac("sha256", pepper).update(scope).digest("hex");
}

function retryAfterSeconds(blockedUntil: Date): number {
  return Math.max(1, Math.ceil((blockedUntil.getTime() - Date.now()) / 1000));
}

export async function loginOwner(input: z.infer<typeof loginInputSchema>) {
  const email = normalizeOwnerEmail(input.email);
  const keyHash = rateLimitKey(email);
  const blockedUntil = await getAuthRateLimit("login_email", keyHash);

  if (blockedUntil && blockedUntil.getTime() > Date.now()) {
    throw new ApiProblem(
      429,
      "LOGIN_RATE_LIMITED",
      "登录尝试过于频繁，请稍后再试",
      undefined,
      retryAfterSeconds(blockedUntil),
    );
  }

  const owner = await findOwnerByEmail(email);
  const passwordMatches = await verifyPassword(owner?.passwordHash ?? dummyPasswordHash, input.password);

  if (!owner || !owner.isEnabled || !passwordMatches) {
    await recordAuthAttempt("login_email", keyHash);
    throw new ApiProblem(401, "INVALID_CREDENTIALS", "邮箱或密码错误");
  }

  await resetAuthRateLimit("login_email", keyHash);
  const issued = await issueSession(owner.id);
  return { owner, issued };
}

export async function registerOwner(
  input: z.infer<typeof registerInputSchema>,
  siteUrl: string,
) {
  if (await ownerAccountExists()) {
    throw new ApiProblem(409, "REGISTRATION_CLOSED", "站长账号已存在，首次注册已关闭");
  }

  const keyHash = rateLimitKey("single-owner-registration");
  const blockedUntil = await getAuthRateLimit("register_global", keyHash);
  if (blockedUntil && blockedUntil.getTime() > Date.now()) {
    throw new ApiProblem(
      429,
      "REGISTER_RATE_LIMITED",
      "注册尝试过于频繁，请稍后再试",
      undefined,
      retryAfterSeconds(blockedUntil),
    );
  }

  const nextBlockedUntil = await recordAuthAttempt("register_global", keyHash);
  if (nextBlockedUntil && nextBlockedUntil.getTime() > Date.now()) {
    throw new ApiProblem(
      429,
      "REGISTER_RATE_LIMITED",
      "注册尝试过于频繁，请稍后再试",
      undefined,
      retryAfterSeconds(nextBlockedUntil),
    );
  }

  const email = normalizeOwnerEmail(input.email);
  const passwordHash = await hashPassword(input.password);
  const material = createSessionMaterial();
  const session = await registerOwnerWithSession({
    email,
    passwordHash,
    displayName: email.split("@")[0] || "站长",
    siteUrl,
    tokenHashHex: material.tokenHashHex,
    expiresAt: material.expiresAt,
  });

  if (!session) {
    throw new ApiProblem(409, "REGISTRATION_CLOSED", "站长账号已存在，首次注册已关闭");
  }

  return {
    owner: { id: session.accountId, email: session.email },
    issued: { token: material.token, session },
  };
}
