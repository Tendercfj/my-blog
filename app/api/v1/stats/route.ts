import type { NextRequest } from "next/server";

import { jsonData } from "@/lib/api/response";
import {
  emptyQuerySchema,
  parseSearchParams,
} from "@/lib/content/api-contract";
import {
  contentMethodNotAllowed,
  contentReadOptions,
  handleContentRead,
} from "@/lib/content/http";
import { getSiteStats } from "@/lib/content/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  return handleContentRead(request, async (requestId) => {
    parseSearchParams(request.nextUrl.searchParams, emptyQuerySchema);
    return jsonData(await getSiteStats(), requestId);
  });
}

export function OPTIONS(request: NextRequest) {
  return contentReadOptions(request);
}

export const POST = contentMethodNotAllowed;
export const PUT = contentMethodNotAllowed;
export const PATCH = contentMethodNotAllowed;
export const DELETE = contentMethodNotAllowed;
