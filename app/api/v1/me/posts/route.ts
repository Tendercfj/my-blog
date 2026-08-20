import type { NextRequest } from "next/server";

import { jsonPage } from "@/lib/api/response";
import { parseSearchParams, ownerPostsQuerySchema } from "@/lib/content/api-contract";
import { toOwnerPostDto } from "@/lib/content/dto";
import { listOwnerPosts } from "@/lib/content/owner-repository";
import { requireApiSession } from "@/lib/auth/api-session";
import { createRequestId, errorResponse } from "@/lib/api/response";
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

export function OPTIONS(request: NextRequest) {
  return contentReadOptions(request, "GET, HEAD, OPTIONS");
}

export const POST = (request: NextRequest) =>
  contentMethodNotAllowedWithAllow(request, "GET, HEAD, OPTIONS");
export const PUT = POST;
export const PATCH = POST;
export const DELETE = POST;
