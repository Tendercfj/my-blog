import type { NextRequest } from "next/server";

import { ApiProblem } from "@/lib/api/problem";
import { jsonPage } from "@/lib/api/response";
import { parseApiInput } from "@/lib/api/validation";
import {
  paginationQuerySchema,
  parseSearchParams,
  slugPathSchema,
} from "@/lib/content/api-contract";
import { toPostSummaryDto } from "@/lib/content/dto";
import {
  contentMethodNotAllowed,
  contentReadOptions,
  handleContentRead,
} from "@/lib/content/http";
import { listPublishedPostsByTagPage } from "@/lib/content/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ slug: string }> };

export function GET(request: NextRequest, context: RouteContext) {
  return handleContentRead(request, async (requestId) => {
    const { slug: rawSlug } = await context.params;
    const slug = parseApiInput(slugPathSchema, rawSlug);
    const query = parseSearchParams(
      request.nextUrl.searchParams,
      paginationQuerySchema,
    );
    const page = await listPublishedPostsByTagPage(slug, query);
    if (!page) {
      throw new ApiProblem(404, "RESOURCE_NOT_FOUND", "标签不存在");
    }
    return jsonPage(
      page.items.map(toPostSummaryDto),
      {
        nextCursor: page.nextCursor,
        hasNextPage: page.nextCursor !== null,
      },
      requestId,
    );
  });
}

export function OPTIONS(request: NextRequest) {
  return contentReadOptions(request);
}

export const POST = contentMethodNotAllowed;
export const PUT = contentMethodNotAllowed;
export const PATCH = contentMethodNotAllowed;
export const DELETE = contentMethodNotAllowed;
