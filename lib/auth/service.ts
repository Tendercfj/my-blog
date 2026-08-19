import "server-only";

import { createHmac } from "node:crypto";

import { z } from "zod";

import { ApiProblem } from "@/lib/api/problem";
import {
  findOwnerByEmail,
  getEmailRateLimit,
  recordFailedLogin,
  resetLoginRateLimit,
} from "@/lib/auth/repository";
import { verifyPassword } from "@/lib/auth/password";
import { issueSession } from "@/lib/auth/session";

const dummyPasswordHash =
  "$argon2id$v=19$m=19456,t=2,p=1$FbudMBkkDLlmSFklU/kPpg$kYsPIzK1iMkO7kUuwnMQ137QxCNb/9Q13XcOBT2Sa1Y";

export const loginInputSchema = z
  .object({
    email: z.string().trim().email("请输入有效邮箱").max(320),
    password: z.string().min(1, "请输入密码").max(1024),
  })
  .strict();

function normalizedEmail(email: string): string {
  return email.trim().toLocaleLowerCase("en-US");
}

function rateLimitKey(email: string): string {
  const pepper = process.env.AUTH_RATE_LIMIT_PEPPER?.trim();
  if (!pepper || pepper.length < 32) {
    throw new ApiProblem(503, "AUTH_NOT_CONFIGURED", "登录服务尚未完成安全配置");
  }
  return createHmac("sha256", pepper).update(email).digest("hex");
}

function retryAfterSeconds(blockedUntil: Date): number {
  return Math.max(1, Math.ceil((blockedUntil.getTime() - Date.now()) / 1000));
}

export async function loginOwner(input: z.infer<typeof loginInputSchema>) {
  const email = normalizedEmail(input.email);
  const keyHash = rateLimitKey(email);
  const blockedUntil = await getEmailRateLimit(keyHash);

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
    await recordFailedLogin(keyHash);
    throw new ApiProblem(401, "INVALID_CREDENTIALS", "邮箱或密码错误");
  }

  await resetLoginRateLimit(keyHash);
  const issued = await issueSession(owner.id);
  return { owner, issued };
}
