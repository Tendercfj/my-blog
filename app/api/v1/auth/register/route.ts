import { NextResponse, type NextRequest } from "next/server";

import { ApiProblem } from "@/lib/api/problem";
import { createRequestId, errorResponse, jsonData } from "@/lib/api/response";
import { parseApiInput } from "@/lib/api/validation";
import { sessionCookie } from "@/lib/auth/cookie";
import { isSameOrigin } from "@/lib/auth/origin";
import { registerOwner } from "@/lib/auth/service";
import { registerInputSchema } from "@/lib/auth/validation";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const requestId = createRequestId();

  try {
    if (!isSameOrigin(request)) {
      throw new ApiProblem(403, "ORIGIN_NOT_ALLOWED", "请求来源不受信任");
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new ApiProblem(400, "INVALID_JSON", "请求 JSON 无法解析");
    }

    const input = parseApiInput(registerInputSchema, body);
    const { owner, issued } = await registerOwner(input, new URL(request.url).origin);
    const response = jsonData(
      {
        account: owner,
        session: {
          id: issued.session.id,
          expiresAt: issued.session.expiresAt.toISOString(),
        },
      },
      requestId,
      { status: 201 },
    );
    response.cookies.set(sessionCookie(issued.token, issued.session.expiresAt));
    return response;
  } catch (error) {
    return errorResponse(error, requestId);
  }
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: { Allow: "POST" } });
}
