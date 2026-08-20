import { z } from "zod";

import { apiErrorEnvelopeSchema } from "@/lib/content/api-contract";

type ApiClientErrorDetail = {
  readonly field?: string;
  readonly reason: string;
  readonly message: string;
};

export class ApiClientError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly requestId: string | null,
    message: string,
    readonly details?: readonly ApiClientErrorDetail[],
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

export async function getJson<T>(
  url: string,
  schema: z.ZodType<T>,
  init?: Pick<RequestInit, "signal">,
): Promise<T> {
  const response = await fetch(url, {
    method: "GET",
    cache: "no-store",
    headers: { Accept: "application/json" },
    signal: init?.signal,
  });

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new ApiClientError(
      response.status,
      "INVALID_RESPONSE",
      response.headers.get("x-request-id"),
      "服务返回了无法解析的响应",
    );
  }

  if (!response.ok) {
    const parsed = apiErrorEnvelopeSchema.safeParse(payload);
    if (parsed.success) {
      throw new ApiClientError(
        response.status,
        parsed.data.error.code,
        parsed.data.error.requestId,
        parsed.data.error.message,
        parsed.data.error.details,
      );
    }
    throw new ApiClientError(
      response.status,
      "REQUEST_FAILED",
      response.headers.get("x-request-id"),
      "请求失败，请稍后重试",
    );
  }

  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw new ApiClientError(
      response.status,
      "INVALID_RESPONSE",
      response.headers.get("x-request-id"),
      "服务返回了不符合约定的数据",
    );
  }

  return parsed.data;
}
