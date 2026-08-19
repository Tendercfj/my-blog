import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { ApiProblem, type ApiErrorDetail } from "@/lib/api/problem";
import { DatabaseUnavailableError } from "@/lib/db/runtime";
import { R2ConfigurationError, R2StorageError } from "@/lib/storage/r2";

export function createRequestId(): string {
  return randomUUID();
}

export function jsonData<T>(data: T, requestId: string, init?: ResponseInit) {
  const response = NextResponse.json({ data, meta: { requestId } }, init);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
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
  response.headers.set("Cache-Control", "private, no-store");
  if (retryAfterSeconds) {
    response.headers.set("Retry-After", String(retryAfterSeconds));
  }
  return response;
}

function zodDetails(error: ZodError): readonly ApiErrorDetail[] {
  return error.issues.map((issue) => ({
    field: issue.path.join(".") || undefined,
    reason: issue.code.toUpperCase(),
    message: issue.message,
  }));
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

  if (error instanceof ZodError) {
    return jsonError(
      422,
      "VALIDATION_FAILED",
      "请求字段校验失败",
      requestId,
      zodDetails(error),
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
