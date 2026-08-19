import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { cookies } from "next/headers";
import type { ResponseCookie } from "next/dist/compiled/@edge-runtime/cookies";

import {
  findSessionByTokenHash,
  insertSession,
  type OwnerSession,
} from "@/lib/auth/repository";

const sessionDurationSeconds = 60 * 60 * 24 * 30;

export const sessionCookieName =
  process.env.NODE_ENV === "production" ? "__Host-blog_session" : "blog_session";

export type IssuedSession = {
  token: string;
  session: OwnerSession;
};

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function issueSession(accountId: string): Promise<IssuedSession> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + sessionDurationSeconds * 1000);
  const session = await insertSession(accountId, hashSessionToken(token), expiresAt);
  return { token, session };
}

export async function findSessionByToken(token: string | undefined): Promise<OwnerSession | null> {
  if (!token || token.length > 256) return null;
  return findSessionByTokenHash(hashSessionToken(token));
}

export async function getCurrentSession(): Promise<OwnerSession | null> {
  const cookieStore = await cookies();
  return findSessionByToken(cookieStore.get(sessionCookieName)?.value);
}

export function sessionCookie(token: string, expiresAt: Date): ResponseCookie {
  return {
    name: sessionCookieName,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
    maxAge: sessionDurationSeconds,
  };
}

export function expiredSessionCookie(): ResponseCookie {
  return {
    name: sessionCookieName,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(0),
    maxAge: 0,
  };
}
