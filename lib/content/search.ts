import type { PostSummary, SearchDocument } from "@/lib/content/types";

export function createSearchIndex(
  posts: readonly PostSummary[],
): readonly SearchDocument[] {
  return posts.map((post) => ({
    slug: post.slug,
    title: post.title,
    excerpt: post.excerpt,
    category: post.category.name,
    tags: post.tags.map((tag) => tag.name),
    publishedAt: post.publishedAt,
  }));
}

export function normalizeSearchText(value: string): string {
  return value.normalize("NFKC").trim().toLocaleLowerCase("zh-CN");
}

export function searchDocuments(
  documents: readonly SearchDocument[],
  rawQuery: string,
): readonly SearchDocument[] {
  const query = normalizeSearchText(rawQuery);
  if (!query) return [];

  return documents
    .flatMap((document) => {
      const title = normalizeSearchText(document.title);
      const taxonomies = normalizeSearchText(`${document.category} ${document.tags.join(" ")}`);
      const excerpt = normalizeSearchText(document.excerpt);
      const score = title.includes(query)
        ? 3
        : taxonomies.includes(query)
          ? 2
          : excerpt.includes(query)
            ? 1
            : 0;
      return score ? [{ document, score }] : [];
    })
    .sort(
      (a, b) =>
        b.score - a.score || b.document.publishedAt.localeCompare(a.document.publishedAt),
    )
    .map(({ document }) => document);
}
