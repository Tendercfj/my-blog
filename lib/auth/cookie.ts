import type { ResponseCookie } from "next/dist/compiled/@edge-runtime/cookies";

const sessionDurationSeconds = 60 * 60 * 24 * 30;

export const sessionCookieName =
  process.env.NODE_ENV === "production" ? "__Host-blog_session" : "blog_session";

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

export function sessionExpiresAt(now = Date.now()): Date {
  return new Date(now + sessionDurationSeconds * 1000);
}
