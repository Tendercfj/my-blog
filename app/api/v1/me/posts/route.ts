import type { NextRequest } from "next/server";

import { ApiProblem } from "@/lib/api/problem";
import { createRequestId, errorResponse, jsonData, jsonPage } from "@/lib/api/response";
import { parseApiInput } from "@/lib/api/validation";
import { isSameOrigin } from "@/lib/auth/origin";
import {
  ownerPostPostSchema,
  ownerPostsQuerySchema,
  parseSearchParams,
} from "@/lib/content/api-contract";
import { toOwnerPostDto } from "@/lib/content/dto";
import { createOwnerPost, listOwnerPosts } from "@/lib/content/owner-repository";
import { requireApiSession } from "@/lib/auth/api-session";
import {
  contentMethodNotAllowedWithAllow,
  contentReadOptions,
} from "@/lib/content/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const requestId = createRequestId(request);
  try {
    const session = await requireApiSession(request);
    const query = parseSearchParams(request.nextUrl.searchParams, ownerPostsQuerySchema);
    const posts = await listOwnerPosts(session.accountId, query);
    return jsonPage(posts.map(toOwnerPostDto), { nextCursor: null, hasNextPage: false }, requestId);
  } catch (error) {
    return errorResponse(error, requestId);
  }
}

export async function POST(request: NextRequest) {
  const requestId = createRequestId(request);
  try {
    if (!isSameOrigin(request)) {
      throw new ApiProblem(403, "ORIGIN_FORBIDDEN", "请求来源不受支持");
    }
    const session = await requireApiSession(request);
    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      throw new ApiProblem(400, "INVALID_JSON", "请求体不是有效 JSON");
    }
    const input = parseApiInput(ownerPostPostSchema, payload);
    const post = await createOwnerPost(session.accountId, input, requestId);
    return jsonData(toOwnerPostDto(post), requestId, { status: 201 });
  } catch (error) {
    return errorResponse(error, requestId);
  }
}

export function OPTIONS(request: NextRequest) {
  return contentReadOptions(request, "GET, HEAD, POST, OPTIONS");
}

export const PUT = (request: NextRequest) =>
  contentMethodNotAllowedWithAllow(request, "GET, HEAD, POST, OPTIONS");
export const PATCH = PUT;
export const DELETE = PUT;
