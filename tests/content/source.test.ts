import { describe, expect, it, vi } from "vitest";

import type { ContentRepository } from "@/lib/content/contracts";
import {
  resolveBlogContentSource,
  selectContentRepository,
} from "@/lib/content/source";

function repository(): ContentRepository {
  return {
    getSiteConfig: vi.fn(),
    listPublishedPosts: vi.fn(),
    getRecentPosts: vi.fn(),
    getPublishedPostBySlug: vi.fn(),
    getArchiveGroups: vi.fn(),
    listTags: vi.fn(),
    listPublishedPostsByTag: vi.fn(),
    listCategories: vi.fn(),
    listPublishedPostsByCategory: vi.fn(),
    getSearchIndex: vi.fn(),
    searchPublishedPosts: vi.fn(),
    getSiteStats: vi.fn(),
    getSidebarData: vi.fn(),
  };
}

describe("BLOG_CONTENT_SOURCE", () => {
  it("requires an explicit supported value outside production", () => {
    expect(() => resolveBlogContentSource({ NODE_ENV: "test" })).toThrow(
      "BLOG_CONTENT_SOURCE must be explicitly set",
    );
    expect(() =>
      resolveBlogContentSource({
        NODE_ENV: "development",
        BLOG_CONTENT_SOURCE: "   ",
      }),
    ).toThrow("BLOG_CONTENT_SOURCE must be explicitly set");
    expect(() =>
      resolveBlogContentSource({
        NODE_ENV: "test",
        BLOG_CONTENT_SOURCE: "fallback",
      }),
    ).toThrow("BLOG_CONTENT_SOURCE must be explicitly set");
  });

  it("defaults production to Neon while rejecting explicit local or invalid values", () => {
    expect(resolveBlogContentSource({ NODE_ENV: "production" })).toBe("neon");
    expect(
      resolveBlogContentSource({
        NODE_ENV: "production",
        BLOG_CONTENT_SOURCE: "   ",
      }),
    ).toBe("neon");
    expect(() =>
      resolveBlogContentSource({
        NODE_ENV: "production",
        BLOG_CONTENT_SOURCE: "local",
      }),
    ).toThrow("forbidden in production");
    expect(
      resolveBlogContentSource({
        NODE_ENV: "production",
        BLOG_CONTENT_SOURCE: "neon",
      }),
    ).toBe("neon");
    expect(() =>
      resolveBlogContentSource({
        NODE_ENV: "production",
        BLOG_CONTENT_SOURCE: "fallback",
      }),
    ).toThrow("BLOG_CONTENT_SOURCE must be explicitly set");
  });

  it("selects the Neon repository for an unconfigured production build", () => {
    const local = repository();
    const neon = repository();

    expect(
      selectContentRepository({ NODE_ENV: "production" }, { local, neon }),
    ).toBe(neon);
  });

  it("selects once without catching Neon failures or falling back", async () => {
    const local = repository();
    const neon = repository();
    vi.mocked(neon.listPublishedPosts).mockRejectedValue(
      new Error("database failed"),
    );
    const selected = selectContentRepository(
      { NODE_ENV: "test", BLOG_CONTENT_SOURCE: "neon" },
      { local, neon },
    );

    await expect(selected.listPublishedPosts()).rejects.toThrow(
      "database failed",
    );
    expect(local.listPublishedPosts).not.toHaveBeenCalled();
  });
});
