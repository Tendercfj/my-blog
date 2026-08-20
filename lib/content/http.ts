import "server-only";

import { NextResponse, type NextRequest } from "next/server";

import { ApiProblem } from "@/lib/api/problem";
import { createRequestId, errorResponse } from "@/lib/api/response";
import { requireApiSession } from "@/lib/auth/api-session";

const contentReadAllow = "GET, HEAD, OPTIONS";

export async function handleContentRead(
  request: NextRequest,
  action: (requestId: string) => Promise<NextResponse>,
) {
  const requestId = createRequestId(request);
  try {
    await requireApiSession(request);
    return await action(requestId);
  } catch (error) {
    return errorResponse(error, requestId);
  }
}

export function contentMethodNotAllowed(request: NextRequest) {
  return handleContentRead(request, async (requestId) => {
    const response = errorResponse(
      new ApiProblem(405, "METHOD_NOT_ALLOWED", "请求方法不受支持"),
      requestId,
    );
    response.headers.set("Allow", contentReadAllow);
    return response;
  });
}

export function contentReadOptions(request?: Pick<Request, "headers">) {
  const requestId = createRequestId(request);
  return new NextResponse(null, {
    status: 204,
    headers: {
      Allow: contentReadAllow,
      "Cache-Control": "private, no-store",
      "X-Request-ID": requestId,
    },
  });
}
