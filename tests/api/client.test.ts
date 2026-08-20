import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { ApiClientError, getJson } from "@/lib/api/client";

const successSchema = z.object({
  data: z.object({ value: z.string() }),
  meta: z.object({ requestId: z.string() }),
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("browser API client", () => {
  it("decodes a valid success envelope", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        data: { value: "ok" },
        meta: { requestId: "request-success" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(getJson("/api/v1/example", successSchema)).resolves.toEqual({
      data: { value: "ok" },
      meta: { requestId: "request-success" },
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/example",
      expect.objectContaining({
        method: "GET",
        cache: "no-store",
        headers: { Accept: "application/json" },
      }),
    );
  });

  it("preserves a stable server error without exposing unknown fields", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json(
          {
            error: {
              code: "AUTHENTICATION_REQUIRED",
              message: "请先登录",
              requestId: "request-error",
              details: [
                {
                  field: "session",
                  reason: "MISSING",
                  message: "Cookie 缺失",
                },
              ],
              databaseUrl: "must-not-escape",
            },
          },
          { status: 401 },
        ),
      ),
    );

    const error = await getJson("/api/v1/example", successSchema).catch(
      (caught: unknown) => caught,
    );
    expect(error).toBeInstanceOf(ApiClientError);
    expect(error).toMatchObject({
      status: 401,
      code: "AUTHENTICATION_REQUIRED",
      requestId: "request-error",
      message: "请先登录",
      details: [
        {
          field: "session",
          reason: "MISSING",
          message: "Cookie 缺失",
        },
      ],
    });
    expect(String(error)).not.toContain("databaseUrl");
    expect(String(error)).not.toContain("must-not-escape");
  });

  it("maps malformed success payloads to a safe client error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json(
          { data: { value: 42 }, meta: { requestId: "request-invalid" } },
          { headers: { "X-Request-ID": "request-invalid" } },
        ),
      ),
    );

    await expect(
      getJson("/api/v1/example", successSchema),
    ).rejects.toMatchObject({
      status: 200,
      code: "INVALID_RESPONSE",
      requestId: "request-invalid",
      message: "服务返回了不符合约定的数据",
    });
  });

  it("maps non-JSON responses without leaking their body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("database connection string", {
          status: 503,
          headers: { "X-Request-ID": "request-non-json" },
        }),
      ),
    );

    await expect(
      getJson("/api/v1/example", successSchema),
    ).rejects.toMatchObject({
      status: 503,
      code: "INVALID_RESPONSE",
      requestId: "request-non-json",
      message: "服务返回了无法解析的响应",
    });
  });
});
