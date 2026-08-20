import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiProblem } from "@/lib/api/problem";
import type { OwnerPost } from "@/lib/content/types";

const sessionMocks = vi.hoisted(() => ({ findSessionByToken: vi.fn() }));
const repositoryMocks = vi.hoisted(() => ({
  listOwnerPosts: vi.fn(),
  getOwnerPostById: vi.fn(),
  createOwnerPost: vi.fn(),
  updateOwnerPost: vi.fn(),
  publishOwnerPost: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => sessionMocks);
vi.mock("@/lib/content/owner-repository", () => repositoryMocks);

import * as ownerPostRoute from "@/app/api/v1/me/posts/[id]/route";
import * as publishRoute from "@/app/api/v1/me/posts/[id]/publish/route";
import * as ownerPostsRoute from "@/app/api/v1/me/posts/route";

const requestId = "123e4567-e89b-42d3-a456-426614174000";
const ownerId = "023e4567-e89b-42d3-a456-426614174000";
const postId = "223e4567-e89b-42d3-a456-426614174000";

const draftPost: OwnerPost = {
  id: postId,
  ownerId,
  version: 1,
  status: "draft",
  deletedAt: null,
  slug: "new-post",
  title: "新文章",
  excerpt: null,
  category: null,
  tags: [],
  cover: null,
  featured: false,
  body: [
    { type: "paragraph", children: [{ type: "text", value: "正文" }] },
  ],
  publishedAt: null,
  updatedAt: "2026-08-20T08:00:00.000Z",
};

const writeFields = {
  slug: "new-post",
  title: "新文章",
  excerpt: null,
  category: null,
  tags: [] as string[],
  cover: null,
  featured: false,
  body: [
    { type: "paragraph" as const, children: [{ type: "text" as const, value: "正文" }] },
  ],
};

function request(
  path: string,
  method = "GET",
  body?: unknown,
  origin: string | null = "https://blog.test",
) {
  const headers = new Headers({
    cookie: "blog_session=valid",
    "x-request-id": requestId,
  });
  if (origin) headers.set("origin", origin);
  if (body !== undefined) headers.set("content-type", "application/json");
  return new NextRequest(`https://blog.test${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("APP_ORIGIN", "https://blog.test");
  sessionMocks.findSessionByToken.mockResolvedValue({ accountId: ownerId });
  repositoryMocks.listOwnerPosts.mockResolvedValue([draftPost]);
  repositoryMocks.getOwnerPostById.mockResolvedValue(draftPost);
  repositoryMocks.createOwnerPost.mockResolvedValue(draftPost);
  repositoryMocks.updateOwnerPost.mockResolvedValue({
    ...draftPost,
    version: 2,
    title: "更新后的文章",
  });
  repositoryMocks.publishOwnerPost.mockResolvedValue({
    ...draftPost,
    version: 2,
    status: "published",
    excerpt: "摘要",
    category: { slug: "notes", name: "notes" },
    cover: {
      src: "/images/posts/cover.svg",
      alt: "封面",
      width: 1200,
      height: 675,
    },
    publishedAt: "2026-08-20T08:30:00.000Z",
  });
});

afterEach(() => vi.unstubAllEnvs());

describe("owner post Route Handlers", () => {
  it("lists draft and published posts through the authenticated owner boundary", async () => {
    const response = await ownerPostsRoute.GET(
      request("/api/v1/me/posts?status=all"),
    );

    expect(response.status).toBe(200);
    expect(repositoryMocks.listOwnerPosts).toHaveBeenCalledWith(ownerId, {
      status: "all",
    });
    await expect(response.json()).resolves.toMatchObject({
      data: [{ id: postId, status: "draft" }],
    });
  });

  it("creates a draft with the current owner and returns its edit resource", async () => {
    const response = await ownerPostsRoute.POST(
      request("/api/v1/me/posts", "POST", writeFields),
    );

    expect(response.status).toBe(201);
    expect(repositoryMocks.createOwnerPost).toHaveBeenCalledWith(
      ownerId,
      writeFields,
      requestId,
    );
    await expect(response.json()).resolves.toMatchObject({
      data: { id: postId, slug: "new-post", status: "draft" },
      meta: { requestId },
    });
  });

  it("rejects cross-origin and invalid create requests before writing", async () => {
    const forbidden = await ownerPostsRoute.POST(
      request("/api/v1/me/posts", "POST", writeFields, "https://evil.test"),
    );
    expect(forbidden.status).toBe(403);
    expect(repositoryMocks.createOwnerPost).not.toHaveBeenCalled();

    const invalid = await ownerPostsRoute.POST(
      request("/api/v1/me/posts", "POST", { ...writeFields, slug: "" }),
    );
    expect(invalid.status).toBe(422);
    expect(repositoryMocks.createOwnerPost).not.toHaveBeenCalled();
  });

  it("passes slug and version through PATCH so the shared schema and editor agree", async () => {
    const input = { ...writeFields, version: 1, title: "更新后的文章" };
    const response = await ownerPostRoute.PATCH(
      request(`/api/v1/me/posts/${postId}`, "PATCH", input),
      { params: Promise.resolve({ id: postId }) },
    );

    expect(response.status).toBe(200);
    expect(repositoryMocks.updateOwnerPost).toHaveBeenCalledWith(
      ownerId,
      postId,
      1,
      input,
      requestId,
    );
  });

  it("returns owner-scoped 404 and stable version conflicts", async () => {
    repositoryMocks.getOwnerPostById.mockResolvedValueOnce(null);
    const hidden = await ownerPostRoute.GET(
      request(`/api/v1/me/posts/${postId}`),
      { params: Promise.resolve({ id: postId }) },
    );
    expect(hidden.status).toBe(404);
    expect(repositoryMocks.getOwnerPostById).toHaveBeenCalledWith(
      ownerId,
      postId,
    );

    repositoryMocks.updateOwnerPost.mockRejectedValueOnce(
      new ApiProblem(409, "VERSION_CONFLICT", "文章已被其他操作更新"),
    );
    const conflict = await ownerPostRoute.PATCH(
      request(`/api/v1/me/posts/${postId}`, "PATCH", {
        ...writeFields,
        version: 1,
      }),
      { params: Promise.resolve({ id: postId }) },
    );
    expect(conflict.status).toBe(409);
    await expect(conflict.json()).resolves.toMatchObject({
      error: { code: "VERSION_CONFLICT", requestId },
    });
  });

  it("publishes a saved draft with an explicit expected version", async () => {
    const response = await publishRoute.POST(
      request(`/api/v1/me/posts/${postId}/publish`, "POST", { version: 2 }),
      { params: Promise.resolve({ id: postId }) },
    );

    expect(response.status).toBe(200);
    expect(repositoryMocks.publishOwnerPost).toHaveBeenCalledWith(
      ownerId,
      postId,
      2,
      requestId,
    );
    await expect(response.json()).resolves.toMatchObject({
      data: { id: postId, status: "published", version: 2 },
    });
  });
});
