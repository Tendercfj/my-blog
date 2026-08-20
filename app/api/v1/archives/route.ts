import type { NextRequest } from "next/server";

import { jsonPage } from "@/lib/api/response";
import {
  paginationQuerySchema,
  parseSearchParams,
} from "@/lib/content/api-contract";
import { toArchiveGroupsDto } from "@/lib/content/dto";
import {
  contentMethodNotAllowed,
  contentReadOptions,
  handleContentRead,
} from "@/lib/content/http";
import { listArchiveGroupsPage } from "@/lib/content/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  return handleContentRead(request, async (requestId) => {
    const query = parseSearchParams(
      request.nextUrl.searchParams,
      paginationQuerySchema,
    );
    const page = await listArchiveGroupsPage(query);
    return jsonPage(
      toArchiveGroupsDto(page.items),
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
