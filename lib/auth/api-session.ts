import "server-only";

import type { NextRequest } from "next/server";

import { ApiProblem } from "@/lib/api/problem";
import { sessionCookieName } from "@/lib/auth/cookie";
import { findSessionByToken } from "@/lib/auth/session";

export async function requireApiSession(request: NextRequest) {
  const session = await findSessionByToken(
    request.cookies.get(sessionCookieName)?.value,
  );
  if (!session) {
    throw new ApiProblem(401, "AUTHENTICATION_REQUIRED", "请先登录");
  }
  return session;
}
