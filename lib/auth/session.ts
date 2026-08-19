import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { sessionCookieName, sessionExpiresAt } from "@/lib/auth/cookie";
import {
  findSessionByTokenHash,
  insertSession,
  type OwnerSession,
} from "@/lib/auth/repository";

export type IssuedSession = {
  token: string;
  session: OwnerSession;
};

export type SessionMaterial = {
  token: string;
  tokenHashHex: string;
  expiresAt: Date;
};

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function createSessionMaterial(): SessionMaterial {
  const token = randomBytes(32).toString("base64url");
  return {
    token,
    tokenHashHex: hashSessionToken(token),
    expiresAt: sessionExpiresAt(),
  };
}

export async function issueSession(accountId: string): Promise<IssuedSession> {
  const material = createSessionMaterial();
  const session = await insertSession(accountId, material.tokenHashHex, material.expiresAt);
  return { token: material.token, session };
}

export async function findSessionByToken(token: string | undefined): Promise<OwnerSession | null> {
  if (!token || token.length > 256) return null;
  return findSessionByTokenHash(hashSessionToken(token));
}

export const getCurrentSession = cache(async (): Promise<OwnerSession | null> => {
  const cookieStore = await cookies();
  return findSessionByToken(cookieStore.get(sessionCookieName)?.value);
});

export async function requireCurrentSession(): Promise<OwnerSession> {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  return session;
}
