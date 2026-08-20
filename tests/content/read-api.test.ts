import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { siteConfig } from "@/content/site";
import { ApiProblem } from "@/lib/api/problem";
import type {
  ArchiveYearGroup,
  PostDetail,
  PostSummary,
  SearchDocument,
  SidebarData,
  SiteStats,
  TaxonomySummary,
} from "@/lib/content/types";

const sessionMocks = vi.hoisted(() => ({ findSessionByToken: vi.fn() }));
const serviceMocks = vi.hoisted(() => ({
  getSiteConfig: vi.fn(),
  listPublishedPostsPage: vi.fn(),
  getPublishedPostBySlug: vi.fn(),
  listArchiveGroupsPage: vi.fn(),
  listTagsPage: vi.fn(),
  listPublishedPostsByTagPage: vi.fn(),
  listCategoriesPage: vi.fn(),
  listPublishedPostsByCategoryPage: vi.fn(),
  searchPublishedPostsPage: vi.fn(),
  getSiteStats: vi.fn(),
  getSidebarData: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => sessionMocks);
vi.mock("@/lib/content/service", () => serviceMocks);

import * as archivesRoute from "@/app/api/v1/archives/route";
import * as categoriesRoute from "@/app/api/v1/categories/route";
import * as categoryPostsRoute from "@/app/api/v1/categories/[slug]/posts/route";
import * as postRoute from "@/app/api/v1/posts/[slug]/route";
import * as postsRoute from "@/app/api/v1/posts/route";
import * as searchRoute from "@/app/api/v1/search/route";
import * as sidebarRoute from "@/app/api/v1/sidebar/route";
import * as siteRoute from "@/app/api/v1/site/route";
import * as statsRoute from "@/app/api/v1/stats/route";
import * as tagPostsRoute from "@/app/api/v1/tags/[slug]/posts/route";
import * as tagsRoute from "@/app/api/v1/tags/route";

const requestId = "123e4567-e89b-42d3-a456-426614174000";

const taxonomy: TaxonomySummary = { slug: "design", name: "设计", count: 1 };
const postSummary: PostSummary = {
  slug: "published-post",
  title: "已发布文章",
  excerpt: "摘要",
  publishedAt: "2026-08-19",
  category: taxonomy,
  tags: [taxonomy],
  cover: {
    src: "/images/posts/calm-interface.svg",
    alt: "封面",
    width: 1280,
    height: 720,
  },
  featured: true,
  readingMinutes: 1,
  wordCount: 10,
};
const postDetail: PostDetail = {
  ...postSummary,
  body: [{ type: "quote", text: "内容" }],
  toc: [],
  previous: null,
  next: null,
};
const archives: readonly ArchiveYearGroup[] = [
  { year: 2026, posts: [postSummary] },
];
const searchDocument: SearchDocument = {
  slug: postSummary.slug,
  title: postSummary.title,
  excerpt: postSummary.excerpt,
  category: taxonomy.name,
  tags: [taxonomy.name],
  publishedAt: postSummary.publishedAt,
};
const stats: SiteStats = { posts: 1, categories: 1, tags: 1, years: 1 };
const sidebar: SidebarData = {
  site: siteConfig,
  recentPosts: [postSummary],
  categories: [taxonomy],
  tags: [taxonomy],
  archiveGroups: archives,
  stats,
};

function request(path: string, method = "GET") {
  return new NextRequest(`https://blog.test${path}`, {
    method,
    headers: {
      cookie: "blog_session=valid",
      "x-request-id": requestId,
    },
  });
}

const successfulEndpoints = [
  { name: "site", call: () => siteRoute.GET(request("/api/v1/site")) },
  { name: "posts", call: () => postsRoute.GET(request("/api/v1/posts")) },
  {
    name: "post detail",
    call: () =>
      postRoute.GET(request("/api/v1/posts/published-post"), {
        params: Promise.resolve({ slug: "published-post" }),
      }),
  },
  {
    name: "archives",
    call: () => archivesRoute.GET(request("/api/v1/archives")),
  },
  { name: "tags", call: () => tagsRoute.GET(request("/api/v1/tags")) },
  {
    name: "tag posts",
    call: () =>
      tagPostsRoute.GET(request("/api/v1/tags/design/posts"), {
        params: Promise.resolve({ slug: "design" }),
      }),
  },
  {
    name: "categories",
    call: () => categoriesRoute.GET(request("/api/v1/categories")),
  },
  {
    name: "category posts",
    call: () =>
      categoryPostsRoute.GET(request("/api/v1/categories/design/posts"), {
        params: Promise.resolve({ slug: "design" }),
      }),
  },
  {
    name: "search",
    call: () => searchRoute.GET(request("/api/v1/search?q=post")),
  },
  { name: "stats", call: () => statsRoute.GET(request("/api/v1/stats")) },
  {
    name: "sidebar",
    call: () => sidebarRoute.GET(request("/api/v1/sidebar")),
  },
];

const getOnlyRoutes = [
  siteRoute,
  postsRoute,
  postRoute,
  archivesRoute,
  tagsRoute,
  tagPostsRoute,
  categoriesRoute,
  categoryPostsRoute,
  searchRoute,
  statsRoute,
  sidebarRoute,
];

beforeEach(() => {
  vi.clearAllMocks();
  sessionMocks.findSessionByToken.mockResolvedValue({ accountId: "owner" });
  serviceMocks.getSiteConfig.mockResolvedValue(siteConfig);
  serviceMocks.listPublishedPostsPage.mockResolvedValue({
    items: [postSummary],
    nextCursor: null,
  });
  serviceMocks.getPublishedPostBySlug.mockResolvedValue(postDetail);
  serviceMocks.listArchiveGroupsPage.mockResolvedValue({
    items: archives,
    nextCursor: null,
  });
  serviceMocks.listTagsPage.mockResolvedValue({
    items: [taxonomy],
    nextCursor: null,
  });
  serviceMocks.listPublishedPostsByTagPage.mockResolvedValue({
    items: [postSummary],
    nextCursor: null,
  });
  serviceMocks.listCategoriesPage.mockResolvedValue({
    items: [taxonomy],
    nextCursor: null,
  });
  serviceMocks.listPublishedPostsByCategoryPage.mockResolvedValue({
    items: [postSummary],
    nextCursor: null,
  });
  serviceMocks.searchPublishedPostsPage.mockResolvedValue({
    items: [searchDocument],
    nextCursor: null,
  });
  serviceMocks.getSiteStats.mockResolvedValue(stats);
  serviceMocks.getSidebarData.mockResolvedValue(sidebar);
});

describe("content read Route Handler contract", () => {
  it.each(successfulEndpoints)(
    "$name returns the shared success envelope and no-store headers",
    async ({ call }) => {
      const response = await call();
      expect(response.status).toBe(200);
      expect(response.headers.get("cache-control")).toBe("private, no-store");
      expect(response.headers.get("x-request-id")).toBe(requestId);
      await expect(response.json()).resolves.toMatchObject({
        data: expect.anything(),
        meta: { requestId },
      });
      expect(sessionMocks.findSessionByToken).toHaveBeenCalledWith("valid");
    },
  );

  it.each(successfulEndpoints)(
    "$name authenticates independently and returns JSON 401",
    async ({ call }) => {
      sessionMocks.findSessionByToken.mockResolvedValueOnce(null);
      const response = await call();
      expect(response.status).toBe(401);
      expect(response.headers.get("content-type")).toContain("application/json");
      expect(response.headers.get("cache-control")).toBe("private, no-store");
      expect(response.headers.get("x-request-id")).toBe(requestId);
      await expect(response.json()).resolves.toEqual({
        error: {
          code: "AUTHENTICATION_REQUIRED",
          message: "请先登录",
          requestId,
        },
      });
      expect(sessionMocks.findSessionByToken).toHaveBeenCalledWith("valid");
    },
  );

  it("validates path slugs and all supported query values", async () => {
    const invalidRequests = [
      siteRoute.GET(request("/api/v1/site?unknown=true")),
      postsRoute.GET(request("/api/v1/posts?limit=0")),
      postsRoute.GET(request("/api/v1/posts?featured=maybe")),
      postsRoute.GET(request("/api/v1/posts?sort=title")),
      postRoute.GET(request("/api/v1/posts/published-post?unknown=true"), {
        params: Promise.resolve({ slug: "published-post" }),
      }),
      postRoute.GET(request("/api/v1/posts/INVALID"), {
        params: Promise.resolve({ slug: "INVALID" }),
      }),
      archivesRoute.GET(request("/api/v1/archives?limit=0")),
      tagsRoute.GET(request("/api/v1/tags?limit=0")),
      tagPostsRoute.GET(request("/api/v1/tags/design/posts?limit=0"), {
        params: Promise.resolve({ slug: "design" }),
      }),
      tagPostsRoute.GET(request("/api/v1/tags/invalid_slug/posts"), {
        params: Promise.resolve({ slug: "invalid_slug" }),
      }),
      categoriesRoute.GET(request("/api/v1/categories?limit=0")),
      categoryPostsRoute.GET(
        request("/api/v1/categories/design/posts?limit=0"),
        { params: Promise.resolve({ slug: "design" }) },
      ),
      categoryPostsRoute.GET(
        request("/api/v1/categories/INVALID/posts"),
        { params: Promise.resolve({ slug: "INVALID" }) },
      ),
      searchRoute.GET(request("/api/v1/search?q=%E3%80%80")),
      statsRoute.GET(request("/api/v1/stats?unknown=true")),
      sidebarRoute.GET(request("/api/v1/sidebar?recentLimit=21")),
    ];
    const responses = await Promise.all(invalidRequests);
    for (const response of responses) {
      expect(response.status).toBe(422);
      await expect(response.json()).resolves.toMatchObject({
        error: { code: "VALIDATION_FAILED", requestId },
      });
    }
  });

  it("forwards normalized query values through the shared service contract", async () => {
    await postsRoute.GET(
      request("/api/v1/posts?limit=2&featured=false&cursor=opaque"),
    );
    expect(serviceMocks.listPublishedPostsPage).toHaveBeenCalledWith({
      limit: 2,
      featured: false,
      cursor: "opaque",
    });

    await searchRoute.GET(
      request("/api/v1/search?q=%E3%80%80Next.js%E3%80%80&limit=8"),
    );
    expect(serviceMocks.searchPublishedPostsPage).toHaveBeenCalledWith(
      "Next.js",
      { q: "Next.js", limit: 8 },
    );

    await sidebarRoute.GET(request("/api/v1/sidebar?recentLimit=0"));
    expect(serviceMocks.getSidebarData).toHaveBeenCalledWith(0);
  });

  it("returns 401 before parsing malformed query input", async () => {
    sessionMocks.findSessionByToken.mockResolvedValueOnce(null);
    const response = await postsRoute.GET(request("/api/v1/posts?limit=0"));
    expect(response.status).toBe(401);
    expect(serviceMocks.listPublishedPostsPage).not.toHaveBeenCalled();
  });

  it("maps invalid cursor failures without exposing implementation details", async () => {
    serviceMocks.listPublishedPostsPage.mockRejectedValueOnce(
      new ApiProblem(400, "INVALID_CURSOR", "分页游标无效或已过期"),
    );
    const response = await postsRoute.GET(
      request("/api/v1/posts?cursor=invalid"),
    );
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "INVALID_CURSOR", requestId },
    });
  });

  it("does not expose internal schema or database field failures as input errors", async () => {
    const decoded = z
      .object({ database_url: z.string() })
      .safeParse({ database_url: 42 });
    if (decoded.success) throw new Error("Expected an internal schema failure");
    serviceMocks.getSiteConfig.mockRejectedValueOnce(decoded.error);

    const response = await siteRoute.GET(request("/api/v1/site"));
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "INTERNAL_ERROR",
        message: "服务暂时不可用",
        requestId,
      },
    });
  });

  it("returns 404 for unknown resources and 200 for valid empty taxonomy", async () => {
    serviceMocks.getPublishedPostBySlug.mockResolvedValueOnce(null);
    const missingPost = await postRoute.GET(
      request("/api/v1/posts/missing"),
      { params: Promise.resolve({ slug: "missing" }) },
    );
    expect(missingPost.status).toBe(404);

    serviceMocks.listPublishedPostsByTagPage
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ items: [], nextCursor: null });
    const missingTag = await tagPostsRoute.GET(
      request("/api/v1/tags/missing/posts"),
      { params: Promise.resolve({ slug: "missing" }) },
    );
    expect(missingTag.status).toBe(404);

    const emptyTag = await tagPostsRoute.GET(
      request("/api/v1/tags/empty-tag/posts"),
      { params: Promise.resolve({ slug: "empty-tag" }) },
    );
    expect(emptyTag.status).toBe(200);
    await expect(emptyTag.json()).resolves.toMatchObject({ data: [] });

    serviceMocks.listPublishedPostsByCategoryPage
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ items: [], nextCursor: null });
    const missingCategory = await categoryPostsRoute.GET(
      request("/api/v1/categories/missing/posts"),
      { params: Promise.resolve({ slug: "missing" }) },
    );
    expect(missingCategory.status).toBe(404);

    const emptyCategory = await categoryPostsRoute.GET(
      request("/api/v1/categories/empty-category/posts"),
      { params: Promise.resolve({ slug: "empty-category" }) },
    );
    expect(emptyCategory.status).toBe(200);
    await expect(emptyCategory.json()).resolves.toMatchObject({ data: [] });
  });

  it("serializes nullable public DTO fields consistently", async () => {
    const summaryResponse = await postsRoute.GET(request("/api/v1/posts"));
    await expect(summaryResponse.json()).resolves.toMatchObject({
      data: [{ updatedAt: null }],
    });

    const detailResponse = await postRoute.GET(
      request("/api/v1/posts/published-post"),
      { params: Promise.resolve({ slug: "published-post" }) },
    );
    await expect(detailResponse.json()).resolves.toMatchObject({
      data: { body: [{ type: "quote", cite: null }] },
    });
  });

  it.each(getOnlyRoutes)(
    "returns authenticated JSON 405 with the allowed read methods",
    async (route) => {
      const response = await route.POST(request("/api/v1/content", "POST"));
      expect(response.status).toBe(405);
      expect(response.headers.get("allow")).toBe("GET, HEAD, OPTIONS");
      expect(response.headers.get("cache-control")).toBe("private, no-store");
      expect(response.headers.get("x-request-id")).toBe(requestId);
      await expect(response.json()).resolves.toMatchObject({
        error: { code: "METHOD_NOT_ALLOWED", requestId },
      });
      expect(sessionMocks.findSessionByToken).toHaveBeenCalledWith("valid");
    },
  );

  it.each(getOnlyRoutes)(
    "does not reveal the method contract without a valid session",
    async (route) => {
      sessionMocks.findSessionByToken.mockResolvedValueOnce(null);
      const response = await route.POST(request("/api/v1/content", "POST"));
      expect(response.status).toBe(401);
      expect(response.headers.get("allow")).toBeNull();
      await expect(response.json()).resolves.toMatchObject({
        error: { code: "AUTHENTICATION_REQUIRED", requestId },
      });
    },
  );

  it("advertises only read methods for credential-less OPTIONS", () => {
    const response = postsRoute.OPTIONS(
      request("/api/v1/posts", "OPTIONS"),
    );
    expect(response.status).toBe(204);
    expect(response.headers.get("allow")).toBe("GET, HEAD, OPTIONS");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("x-request-id")).toBe(requestId);
    expect(sessionMocks.findSessionByToken).not.toHaveBeenCalled();
  });
});
