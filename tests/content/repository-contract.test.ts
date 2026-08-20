import { describe, expect, it } from "vitest";

import { posts } from "@/content/posts";
import { siteConfig } from "@/content/site";
import type { QueryExecutor } from "@/lib/content/contracts";
import { createLocalContentRepository } from "@/lib/content/local-repository";
import { createNeonContentRepository } from "@/lib/content/neon-repository";
import type { PostRecord, SiteConfig } from "@/lib/content/types";

function postRow(post: PostRecord) {
  return {
    slug: post.slug,
    title: post.title,
    excerpt: post.excerpt,
    published_at: `${post.publishedAt}T00:00:00.000Z`,
    content_updated_at: post.updatedAt
      ? `${post.updatedAt}T00:00:00.000Z`
      : null,
    category_slug: post.category,
    tags: post.tags,
    cover_src: post.cover.src,
    cover_alt: post.cover.alt,
    cover_width: post.cover.width,
    cover_height: post.cover.height,
    featured: post.featured ?? false,
    body: post.body,
  };
}

function fixtureExecutor(
  site: SiteConfig,
  records: readonly PostRecord[],
): QueryExecutor {
  return {
    async queryRows(statement, parameters = []) {
      if (statement.includes("content:site")) {
        return [
          {
            name: site.name,
            description: site.description,
            site_url: site.siteUrl,
            logo_src: site.logo.src,
            logo_alt: site.logo.alt,
            logo_width: site.logo.width,
            logo_height: site.logo.height,
            announcement: site.announcement,
            navigation: site.navigation,
            author_name: site.author.name,
            author_role: site.author.role,
            author_bio: site.author.bio,
            avatar_src: site.author.avatar.src,
            avatar_alt: site.author.avatar.alt,
            avatar_width: site.author.avatar.width,
            avatar_height: site.author.avatar.height,
            author_links: site.author.links,
            about: site.about,
          },
        ];
      }
      if (statement.includes("content:tag-exists")) {
        return site.tags.filter((tag) => tag.slug === parameters[0]);
      }
      if (statement.includes("content:category-exists")) {
        return site.categories.filter(
          (category) => category.slug === parameters[0],
        );
      }
      if (statement.includes("content:categories")) return site.categories;
      if (statement.includes("content:tags")) return site.tags;
      if (statement.includes("content:posts-by-tag")) {
        return records
          .filter((post) => post.tags.includes(String(parameters[0])))
          .map(postRow);
      }
      if (statement.includes("content:posts-by-category")) {
        return records
          .filter((post) => post.category === parameters[0])
          .map(postRow);
      }
      if (
        statement.includes("content:posts") ||
        statement.includes("content:search-posts")
      ) {
        return records.map(postRow);
      }
      throw new Error(`Unexpected fixture query: ${statement}`);
    },
  };
}

function repositories() {
  const site: SiteConfig = {
    ...siteConfig,
    categories: [
      ...siteConfig.categories,
      { slug: "empty-category", name: "空分类" },
    ],
    tags: [...siteConfig.tags, { slug: "empty-tag", name: "空标签" }],
  };
  return {
    local: createLocalContentRepository(site, posts),
    neon: createNeonContentRepository(fixtureExecutor(site, posts)),
  };
}

describe("content repository contract", () => {
  it("keeps local and Neon DTOs, dates, nulls, and sorting aligned", async () => {
    const { local, neon } = repositories();

    await expect(neon.getSiteConfig()).resolves.toEqual(
      await local.getSiteConfig(),
    );
    await expect(neon.listPublishedPosts()).resolves.toEqual(
      await local.listPublishedPosts(),
    );
    await expect(neon.getArchiveGroups()).resolves.toEqual(
      await local.getArchiveGroups(),
    );
    await expect(neon.listCategories()).resolves.toEqual(
      await local.listCategories(),
    );
    await expect(neon.listTags()).resolves.toEqual(await local.listTags());
    await expect(neon.getSiteStats()).resolves.toEqual(
      await local.getSiteStats(),
    );
  });

  it("derives published ordering and taxonomy counts from independent rows", async () => {
    const site: SiteConfig = {
      ...siteConfig,
      categories: [
        { slug: "alpha", name: "Alpha" },
        { slug: "beta", name: "Beta" },
        { slug: "empty-category", name: "Empty" },
      ],
      tags: [
        { slug: "red", name: "Red" },
        { slug: "blue", name: "Blue" },
        { slug: "empty-tag", name: "Empty" },
      ],
    };
    const records: readonly PostRecord[] = [
      { ...posts[1], category: "alpha", tags: ["red", "blue"] },
      { ...posts[0], category: "beta", tags: ["red"] },
    ];
    const neon = createNeonContentRepository(fixtureExecutor(site, records));

    await expect(neon.listPublishedPosts()).resolves.toMatchObject([
      { slug: posts[0].slug },
      { slug: posts[1].slug },
    ]);
    await expect(neon.listCategories()).resolves.toEqual([
      { slug: "alpha", name: "Alpha", count: 1 },
      { slug: "beta", name: "Beta", count: 1 },
      { slug: "empty-category", name: "Empty", count: 0 },
    ]);
    await expect(neon.listTags()).resolves.toEqual([
      { slug: "red", name: "Red", count: 2 },
      { slug: "blue", name: "Blue", count: 1 },
      { slug: "empty-tag", name: "Empty", count: 0 },
    ]);
  });

  it("distinguishes unknown taxonomy from a valid empty taxonomy", async () => {
    const { local, neon } = repositories();

    for (const repository of [local, neon]) {
      await expect(
        repository.listPublishedPostsByTag("missing"),
      ).resolves.toBeNull();
      await expect(
        repository.listPublishedPostsByTag("empty-tag"),
      ).resolves.toEqual([]);
      await expect(
        repository.listPublishedPostsByCategory("missing"),
      ).resolves.toBeNull();
      await expect(
        repository.listPublishedPostsByCategory("empty-category"),
      ).resolves.toEqual([]);
    }
  });

  it("returns null for an unknown published post", async () => {
    const { local, neon } = repositories();
    await expect(local.getPublishedPostBySlug("missing")).resolves.toBeNull();
    await expect(neon.getPublishedPostBySlug("missing")).resolves.toBeNull();
  });

  it("uses parameters for taxonomy and search input", async () => {
    const calls: { statement: string; parameters: readonly unknown[] }[] = [];
    const fixture = fixtureExecutor(siteConfig, posts);
    const neon = createNeonContentRepository({
      async queryRows(statement, parameters = []) {
        calls.push({ statement, parameters });
        return fixture.queryRows(statement, parameters);
      },
    });

    await neon.listPublishedPostsByTag("css");
    await neon.listPublishedPostsByCategory("frontend");
    await neon.searchPublishedPosts("100%_\\");

    expect(
      calls.find((call) => call.statement.includes("content:tag-exists"))
        ?.parameters,
    ).toEqual(["css"]);
    expect(
      calls.find((call) =>
        call.statement.includes("content:posts-by-category"),
      )?.parameters,
    ).toEqual(["frontend"]);
    expect(
      calls.find((call) => call.statement.includes("content:search-posts"))
        ?.parameters,
    ).toEqual(["%100\\%\\_\\\\%"]);

    const searchStatement = calls.find((call) =>
      call.statement.includes("content:search-posts"),
    )?.statement;
    const escapeClause = "ILIKE $1 ESCAPE E'\\\\'";
    expect(searchStatement?.split(escapeClause)).toHaveLength(5);

    const postStatements = calls
      .filter(
        ({ statement }) =>
          statement.includes("content:posts") ||
          statement.includes("content:search-posts"),
      )
      .map(({ statement }) => statement);
    expect(postStatements.length).toBeGreaterThan(0);
    expect(
      postStatements.every((statement) =>
        statement.includes("FROM blog.public_posts AS p"),
      ),
    ).toBe(true);
  });
});
