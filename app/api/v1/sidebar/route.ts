import type { NextRequest } from "next/server";

import { jsonData } from "@/lib/api/response";
import {
  parseSearchParams,
  sidebarQuerySchema,
} from "@/lib/content/api-contract";
import { toSidebarDto } from "@/lib/content/dto";
import {
  contentMethodNotAllowed,
  contentReadOptions,
  handleContentRead,
} from "@/lib/content/http";
import { getSidebarData } from "@/lib/content/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  return handleContentRead(request, async (requestId) => {
    const query = parseSearchParams(
      request.nextUrl.searchParams,
      sidebarQuerySchema,
    );
    return jsonData(
      toSidebarDto(await getSidebarData(query.recentLimit)),
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
