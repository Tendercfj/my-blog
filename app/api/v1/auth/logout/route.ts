import { NextResponse, type NextRequest } from "next/server";

import { ApiProblem } from "@/lib/api/problem";
import { createRequestId, errorResponse } from "@/lib/api/response";
import { isSameOrigin } from "@/lib/auth/origin";
import { revokeSession } from "@/lib/auth/repository";
import {
  expiredSessionCookie,
  findSessionByToken,
  sessionCookieName,
} from "@/lib/auth/session";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const requestId = createRequestId();

  try {
    if (!isSameOrigin(request)) {
      throw new ApiProblem(403, "ORIGIN_NOT_ALLOWED", "请求来源不受信任");
    }

    const session = await findSessionByToken(request.cookies.get(sessionCookieName)?.value);
    if (session) {
      await revokeSession(session.id);
    }

    const response = new NextResponse(null, { status: 204 });
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.set("X-Request-Id", requestId);
    response.cookies.set(expiredSessionCookie());
    return response;
  } catch (error) {
    const response = errorResponse(error, requestId);
    response.cookies.set(expiredSessionCookie());
    return response;
  }
}
