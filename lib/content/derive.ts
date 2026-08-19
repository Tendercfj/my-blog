import type {
  ArchiveYearGroup,
  ContentBlock,
  PostDetail,
  PostLink,
  PostRecord,
  PostSummary,
  TaxonomyDefinition,
  TaxonomySummary,
  TocItem,
} from "@/lib/content/types";

function bodyText(blocks: readonly ContentBlock[]): string {
  return blocks
    .map((block) => {
      switch (block.type) {
        case "heading":
          return block.text;
        case "paragraph":
          return block.children.map((child) => child.value).join("");
        case "list":
          return block.items.join(" ");
        case "quote":
          return block.text;
        case "image":
          return block.caption ?? "";
        case "code":
          return block.code;
      }
    })
    .join(" ");
}

export function countWords(blocks: readonly ContentBlock[]): number {
  const text = bodyText(blocks);
  const cjkCount = text.match(/[\u3400-\u9fff]/g)?.length ?? 0;
  const latinCount = text
    .replace(/[\u3400-\u9fff]/g, " ")
    .match(/[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*/g)?.length ?? 0;
  return cjkCount + latinCount;
}

export function readingMinutes(wordCount: number): number {
  return Math.max(1, Math.ceil(wordCount / 300));
}

export function createTaxonomySummaries(
  definitions: readonly TaxonomyDefinition[],
  posts: readonly PostRecord[],
  kind: "category" | "tag",
): readonly TaxonomySummary[] {
  return definitions
    .map((definition) => ({
      ...definition,
      count: posts.filter((post) =>
        kind === "category"
          ? post.category === definition.slug
          : post.tags.includes(definition.slug),
      ).length,
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "zh-CN"));
}

export function sortPosts(posts: readonly PostRecord[]): readonly PostRecord[] {
  return [...posts].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}

export function createPostSummaries(
  posts: readonly PostRecord[],
  categories: readonly TaxonomySummary[],
  tags: readonly TaxonomySummary[],
): readonly PostSummary[] {
  const categoryMap = new Map(categories.map((item) => [item.slug, item]));
  const tagMap = new Map(tags.map((item) => [item.slug, item]));

  return sortPosts(posts).map((post) => {
    const wordCount = countWords(post.body);
    const category = categoryMap.get(post.category);
    if (!category) {
      throw new Error(`Post ${post.slug} has no resolved category`);
    }

    return {
      slug: post.slug,
      title: post.title,
      excerpt: post.excerpt,
      publishedAt: post.publishedAt,
      updatedAt: post.updatedAt,
      category,
      tags: post.tags.map((slug) => {
        const tag = tagMap.get(slug);
        if (!tag) {
          throw new Error(`Post ${post.slug} has no resolved tag: ${slug}`);
        }
        return tag;
      }),
      cover: post.cover,
      featured: post.featured ?? false,
      wordCount,
      readingMinutes: readingMinutes(wordCount),
    };
  });
}

export function createArchiveGroups(
  posts: readonly PostSummary[],
): readonly ArchiveYearGroup[] {
  const groups = new Map<number, PostSummary[]>();

  for (const post of posts) {
    const year = Number(post.publishedAt.slice(0, 4));
    const yearPosts = groups.get(year) ?? [];
    yearPosts.push(post);
    groups.set(year, yearPosts);
  }

  return [...groups.entries()]
    .sort(([yearA], [yearB]) => yearB - yearA)
    .map(([year, yearPosts]) => ({ year, posts: yearPosts }));
}

export function createToc(blocks: readonly ContentBlock[]): readonly TocItem[] {
  return blocks.flatMap((block) =>
    block.type === "heading"
      ? [{ id: block.id, text: block.text, level: block.level }]
      : [],
  );
}

export function createPostDetail(
  record: PostRecord,
  summary: PostSummary,
  summaries: readonly PostSummary[],
): PostDetail {
  const index = summaries.findIndex((post) => post.slug === record.slug);
  const toLink = (post: PostSummary | undefined): PostLink | null =>
    post ? { slug: post.slug, title: post.title } : null;

  return {
    ...summary,
    body: record.body,
    toc: createToc(record.body),
    previous: toLink(summaries[index + 1]),
    next: toLink(summaries[index - 1]),
  };
}
