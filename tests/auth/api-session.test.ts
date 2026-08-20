import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const sessionMocks = vi.hoisted(() => ({ findSessionByToken: vi.fn() }));

vi.mock("@/lib/auth/session", () => sessionMocks);

import { requireApiSession } from "@/lib/auth/api-session";

describe("API session guard", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the authoritative database session for the opaque cookie", async () => {
    const session = { id: "session", accountId: "owner" };
    sessionMocks.findSessionByToken.mockResolvedValue(session);
    const request = new NextRequest("https://blog.test/api/v1/site", {
      headers: { cookie: "blog_session=opaque-token" },
    });

    await expect(requireApiSession(request)).resolves.toBe(session);
    expect(sessionMocks.findSessionByToken).toHaveBeenCalledWith("opaque-token");
  });

  it("rejects missing, expired, forged, or revoked sessions as JSON-ready 401", async () => {
    sessionMocks.findSessionByToken.mockResolvedValue(null);
    const request = new NextRequest("https://blog.test/api/v1/site");

    await expect(requireApiSession(request)).rejects.toMatchObject({
      status: 401,
      code: "AUTHENTICATION_REQUIRED",
    });
    expect(sessionMocks.findSessionByToken).toHaveBeenCalledWith(undefined);
  });
});
