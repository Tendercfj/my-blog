import { describe, expect, it } from "vitest";

import { posts } from "@/content/posts";
import { siteConfig } from "@/content/site";
import { ApiProblem } from "@/lib/api/problem";
import {
  paginationQuerySchema,
  parseSearchParams,
  postsQuerySchema,
  searchQuerySchema,
  sidebarQuerySchema,
} from "@/lib/content/api-contract";
import { createLocalContentRepository } from "@/lib/content/local-repository";
import { createContentReadService } from "@/lib/content/service";
import type { SiteConfig } from "@/lib/content/types";

function service() {
  const fixtureSite: SiteConfig = {
    ...siteConfig,
    categories: [
      ...siteConfig.categories,
      { slug: "empty-category", name: "空分类" },
    ],
    tags: [...siteConfig.tags, { slug: "empty-tag", name: "空标签" }],
  };
  return createContentReadService(
    createLocalContentRepository(fixtureSite, posts),
  );
}

describe("content read query contract", () => {
  it("applies defaults and rejects duplicate, unknown, or out-of-range values", () => {
    expect(
      parseSearchParams(new URLSearchParams(), paginationQuerySchema),
    ).toEqual({ limit: 20 });
    expect(
      parseSearchParams(
        new URLSearchParams("limit=3&featured=false"),
        postsQuerySchema,
      ),
    ).toEqual({ limit: 3, featured: false });
    expect(
      parseSearchParams(new URLSearchParams(), sidebarQuerySchema),
    ).toEqual({ recentLimit: 4 });

    expect(() =>
      parseSearchParams(new URLSearchParams("limit=0"), paginationQuerySchema),
    ).toThrow();
    expect(() =>
      parseSearchParams(
        new URLSearchParams("limit=1&limit=2"),
        paginationQuerySchema,
      ),
    ).toThrow();
    expect(() =>
      parseSearchParams(
        new URLSearchParams("sort=title"),
        paginationQuerySchema,
      ),
    ).toThrow();
    expect(() =>
      parseSearchParams(
        new URLSearchParams("q=%E3%80%80"),
        searchQuerySchema,
      ),
    ).toThrow();
  });
});

describe("content read service", () => {
  it("paginates published posts with an opaque contextual cursor", async () => {
    const content = service();
    const first = await content.listPublishedPostsPage({ limit: 2 });

    expect(first.items).toHaveLength(2);
    expect(first.nextCursor).toMatch(/^[^.]+\.[^.]+$/);
    expect(first.nextCursor).not.toContain(first.items[1].slug);

    const second = await content.listPublishedPostsPage({
      limit: 2,
      cursor: first.nextCursor ?? undefined,
    });
    expect(second.items[0].slug).toBe(posts[2].slug);

    await expect(
      content.listPublishedPostsPage({
        limit: 2,
        cursor: `${first.nextCursor?.slice(0, -1)}x`,
      }),
    ).rejects.toMatchObject({ status: 400, code: "INVALID_CURSOR" });
    await expect(
      content.listPublishedPostsPage({
        limit: 2,
        featured: true,
        cursor: first.nextCursor ?? undefined,
      }),
    ).rejects.toMatchObject({ status: 400, code: "INVALID_CURSOR" });
    await expect(
      content.listPublishedPostsPage({ limit: 2, cursor: "" }),
    ).rejects.toMatchObject({ status: 400, code: "INVALID_CURSOR" });
    await expect(
      content.listPublishedPostsPage({
        limit: 2,
        cursor: "x".repeat(2049),
      }),
    ).rejects.toMatchObject({ status: 400, code: "INVALID_CURSOR" });
  });

  it("applies featured filtering before pagination", async () => {
    const page = await service().listPublishedPostsPage({
      limit: 100,
      featured: true,
    });
    expect(page.items.length).toBeGreaterThan(0);
    expect(page.items.every((post) => post.featured)).toBe(true);
  });

  it("keeps unknown taxonomy distinct from a valid empty taxonomy", async () => {
    const content = service();
    await expect(
      content.listPublishedPostsByTagPage("missing", { limit: 20 }),
    ).resolves.toBeNull();
    await expect(
      content.listPublishedPostsByTagPage("empty-tag", { limit: 20 }),
    ).resolves.toEqual({ items: [], nextCursor: null });
    await expect(
      content.listPublishedPostsByCategoryPage("missing", { limit: 20 }),
    ).resolves.toBeNull();
    await expect(
      content.listPublishedPostsByCategoryPage("empty-category", { limit: 20 }),
    ).resolves.toEqual({ items: [], nextCursor: null });
  });

  it("counts archive limits by posts and supports arbitrary sidebar limits", async () => {
    const content = service();
    const archivePage = await content.listArchiveGroupsPage({ limit: 3 });
    expect(
      archivePage.items.reduce(
        (total, group) => total + group.posts.length,
        0,
      ),
    ).toBe(3);
    expect(archivePage.nextCursor).not.toBeNull();

    await expect(content.getSidebarData(0)).resolves.toMatchObject({
      recentPosts: [],
    });
    await expect(content.getSidebarData(21)).rejects.toBeInstanceOf(ApiProblem);
  });

  it("binds search cursors to the normalized query", async () => {
    const content = service();
    const first = await content.searchPublishedPostsPage("的", { limit: 1 });
    expect(first.items).toHaveLength(1);
    expect(first.nextCursor).not.toBeNull();

    await expect(
      content.searchPublishedPostsPage("设计", {
        limit: 1,
        cursor: first.nextCursor ?? undefined,
      }),
    ).rejects.toMatchObject({ status: 400, code: "INVALID_CURSOR" });
  });
});
