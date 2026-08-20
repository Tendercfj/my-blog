import type { NextRequest } from "next/server";

import { ApiProblem } from "@/lib/api/problem";
import { createRequestId, errorResponse, jsonData } from "@/lib/api/response";
import { parseApiInput } from "@/lib/api/validation";
import { requireApiSession } from "@/lib/auth/api-session";
import { isSameOrigin } from "@/lib/auth/origin";
import {
  ownerPostIdSchema,
  ownerPostPublishBodySchema,
} from "@/lib/content/api-contract";
import { toOwnerPostDto } from "@/lib/content/dto";
import { publishOwnerPost } from "@/lib/content/owner-repository";
import {
  contentMethodNotAllowedWithAllow,
  contentReadOptions,
} from "@/lib/content/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const requestId = createRequestId(request);
  try {
    if (!isSameOrigin(request)) {
      throw new ApiProblem(403, "ORIGIN_FORBIDDEN", "请求来源不受支持");
    }
    const session = await requireApiSession(request);
    const id = parseApiInput(ownerPostIdSchema, (await context.params).id);
    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      throw new ApiProblem(400, "INVALID_JSON", "请求体不是有效 JSON");
    }
    const input = parseApiInput(ownerPostPublishBodySchema, payload);
    const post = await publishOwnerPost(
      session.accountId,
      id,
      input.version,
      requestId,
    );
    return jsonData(toOwnerPostDto(post), requestId);
  } catch (error) {
    return errorResponse(error, requestId);
  }
}

export function OPTIONS(request: NextRequest) {
  return contentReadOptions(request, "POST, OPTIONS");
}

export const GET = (request: NextRequest) =>
  contentMethodNotAllowedWithAllow(request, "POST, OPTIONS");
export const PUT = GET;
export const PATCH = GET;
export const DELETE = GET;
