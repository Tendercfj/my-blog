import type { NextRequest } from "next/server";

import { ApiProblem } from "@/lib/api/problem";
import { createRequestId, errorResponse, jsonData } from "@/lib/api/response";
import { findSessionByToken, sessionCookieName } from "@/lib/auth/session";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const requestId = createRequestId();

  try {
    const session = await findSessionByToken(request.cookies.get(sessionCookieName)?.value);
    if (!session) {
      throw new ApiProblem(401, "AUTHENTICATION_REQUIRED", "请先登录");
    }

    return jsonData(
      {
        account: { id: session.accountId, email: session.email },
        session: {
          id: session.id,
          createdAt: session.createdAt.toISOString(),
          expiresAt: session.expiresAt.toISOString(),
        },
      },
      requestId,
    );
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
