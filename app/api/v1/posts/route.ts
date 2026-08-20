import type { NextRequest } from "next/server";

import { jsonPage } from "@/lib/api/response";
import { parseSearchParams, postsQuerySchema } from "@/lib/content/api-contract";
import { toPostSummaryDto } from "@/lib/content/dto";
import {
  contentMethodNotAllowed,
  contentReadOptions,
  handleContentRead,
} from "@/lib/content/http";
import { listPublishedPostsPage } from "@/lib/content/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  return handleContentRead(request, async (requestId) => {
    const query = parseSearchParams(request.nextUrl.searchParams, postsQuerySchema);
    const page = await listPublishedPostsPage(query);
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
