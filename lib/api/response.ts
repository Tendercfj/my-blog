import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { ApiProblem, type ApiErrorDetail } from "@/lib/api/problem";
import { DatabaseUnavailableError } from "@/lib/db/runtime";
import { R2ConfigurationError, R2StorageError } from "@/lib/storage/r2";

const requestIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function createRequestId(request?: Pick<Request, "headers">): string {
  const supplied = request?.headers.get("x-request-id")?.trim();
  return supplied && requestIdPattern.test(supplied) ? supplied : randomUUID();
}

function applyResponseHeaders(response: NextResponse, requestId: string) {
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("X-Request-ID", requestId);
  return response;
}

export function jsonData<T>(data: T, requestId: string, init?: ResponseInit) {
  const response = NextResponse.json({ data, meta: { requestId } }, init);
  return applyResponseHeaders(response, requestId);
}

export function jsonPage<T>(
  data: readonly T[],
  pageInfo: { nextCursor: string | null; hasNextPage: boolean },
  requestId: string,
  init?: ResponseInit,
) {
  const response = NextResponse.json(
    { data, pageInfo, meta: { requestId } },
    init,
  );
  return applyResponseHeaders(response, requestId);
}

function jsonError(
  status: number,
  code: string,
  message: string,
  requestId: string,
  details?: readonly ApiErrorDetail[],
  retryAfterSeconds?: number,
) {
  const response = NextResponse.json(
    {
      error: {
        code,
        message,
        requestId,
        ...(details?.length ? { details } : {}),
      },
    },
    { status },
  );
  applyResponseHeaders(response, requestId);
  if (retryAfterSeconds) {
    response.headers.set("Retry-After", String(retryAfterSeconds));
  }
  return response;
}

export function errorResponse(error: unknown, requestId: string) {
  if (error instanceof ApiProblem) {
    return jsonError(
      error.status,
      error.code,
      error.message,
      requestId,
      error.details,
      error.retryAfterSeconds,
    );
  }

  if (error instanceof DatabaseUnavailableError) {
    return jsonError(503, "DATABASE_UNAVAILABLE", "数据库暂时不可用", requestId);
  }

  if (error instanceof R2ConfigurationError) {
    return jsonError(503, "STORAGE_NOT_CONFIGURED", "对象存储尚未完成配置", requestId);
  }

  if (error instanceof R2StorageError) {
    return jsonError(503, "STORAGE_UNAVAILABLE", "对象存储暂时不可用", requestId);
  }

  return jsonError(500, "INTERNAL_ERROR", "服务暂时不可用", requestId);
}
