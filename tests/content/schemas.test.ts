import { describe, expect, it } from "vitest";

import { posts } from "@/content/posts";
import { decodePostRows } from "@/lib/content/schemas";

function validRow() {
  const post = posts[0];
  return {
    slug: post.slug,
    title: post.title,
    excerpt: post.excerpt,
    published_at: `${post.publishedAt}T00:00:00Z`,
    content_updated_at: null,
    category_slug: post.category,
    tags: JSON.stringify(post.tags),
    cover_src: post.cover.src,
    cover_alt: post.cover.alt,
    cover_width: post.cover.width,
    cover_height: post.cover.height,
    featured: true,
    body: JSON.stringify(post.body),
  };
}

describe("database content schemas", () => {
  it("normalizes database dates and JSON before returning domain rows", () => {
    expect(decodePostRows([validRow()])[0]).toMatchObject({
      publishedAt: posts[0].publishedAt,
      updatedAt: undefined,
      tags: posts[0].tags,
      body: posts[0].body,
    });
  });

  it("rejects invalid ContentBlock data at the repository boundary", () => {
    const row = validRow();
    row.body = JSON.stringify([
      { type: "heading", level: 2, id: "same", text: "One" },
      { type: "heading", level: 2, id: "same", text: "Two" },
    ]);
    expect(() => decodePostRows([row])).toThrow("Duplicate heading id");
  });
});
