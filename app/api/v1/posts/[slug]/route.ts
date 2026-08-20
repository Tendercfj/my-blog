import type { NextRequest } from "next/server";

import { ApiProblem } from "@/lib/api/problem";
import { jsonData } from "@/lib/api/response";
import { parseApiInput } from "@/lib/api/validation";
import {
  emptyQuerySchema,
  parseSearchParams,
  slugPathSchema,
} from "@/lib/content/api-contract";
import { toPostDetailDto } from "@/lib/content/dto";
import {
  contentMethodNotAllowed,
  contentReadOptions,
  handleContentRead,
} from "@/lib/content/http";
import { getPublishedPostBySlug } from "@/lib/content/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ slug: string }> };

export function GET(request: NextRequest, context: RouteContext) {
  return handleContentRead(request, async (requestId) => {
    parseSearchParams(request.nextUrl.searchParams, emptyQuerySchema);
    const { slug: rawSlug } = await context.params;
    const slug = parseApiInput(slugPathSchema, rawSlug);
    const post = await getPublishedPostBySlug(slug);
    if (!post) {
      throw new ApiProblem(404, "RESOURCE_NOT_FOUND", "文章不存在");
    }
    return jsonData(toPostDetailDto(post), requestId);
  });
}

export function OPTIONS(request: NextRequest) {
  return contentReadOptions(request);
}

export const POST = contentMethodNotAllowed;
export const PUT = contentMethodNotAllowed;
export const PATCH = contentMethodNotAllowed;
export const DELETE = contentMethodNotAllowed;
