import "server-only";

import type {
  ContentRepository,
  QueryExecutor,
} from "@/lib/content/contracts";
import {
  createArchiveGroups,
  createPostDetail,
  createPostSummaries,
  createTaxonomySummaries,
} from "@/lib/content/derive";
import { createSearchIndex, normalizeSearchText, searchDocuments } from "@/lib/content/search";
import {
  decodePostRows,
  decodeSiteConfig,
  decodeTaxonomyRows,
} from "@/lib/content/schemas";
import type {
  PostRecord,
  PostSummary,
  SiteStats,
  TaxonomyDefinition,
  TaxonomySummary,
} from "@/lib/content/types";
import { queryRows } from "@/lib/db/runtime";

const siteSql = `
  /* content:site */
  SELECT
    s.name,
    s.description,
    s.site_url,
    s.logo_src,
    s.logo_alt,
    s.logo_width,
    s.logo_height,
    s.announcement,
    s.navigation,
    p.name AS author_name,
    p.role AS author_role,
    p.bio AS author_bio,
    p.avatar_src,
    p.avatar_alt,
    p.avatar_width,
    p.avatar_height,
    p.links AS author_links,
    p.about
  FROM blog.site_settings AS s
  CROSS JOIN blog.author_profiles AS p
  WHERE s.singleton_key = 1
  LIMIT 1
`;

const categoryDefinitionsSql = `
  /* content:categories */
  SELECT slug, name
  FROM blog.categories
  ORDER BY slug ASC
`;

const tagDefinitionsSql = `
  /* content:tags */
  SELECT slug, name
  FROM blog.tags
  ORDER BY slug ASC
`;

const publishedPostColumns = `
  p.slug,
  p.title,
  p.excerpt,
  p.published_at,
  p.content_updated_at,
  c.slug AS category_slug,
  COALESCE(
    jsonb_agg(t.slug ORDER BY pt.created_at, t.slug)
      FILTER (WHERE t.id IS NOT NULL),
    '[]'::jsonb
  ) AS tags,
  p.cover_src,
  p.cover_alt,
  p.cover_width,
  p.cover_height,
  p.featured,
  p.body
`;

const publishedPostJoins = `
  FROM blog.public_posts AS p
  JOIN blog.categories AS c ON c.id = p.category_id
  LEFT JOIN blog.post_tags AS pt ON pt.post_id = p.id
  LEFT JOIN blog.tags AS t ON t.id = pt.tag_id
`;

const publishedPostGroupAndOrder = `
  GROUP BY p.id, p.slug, p.title, p.excerpt, p.published_at,
    p.content_updated_at, c.slug, p.cover_src, p.cover_alt,
    p.cover_width, p.cover_height, p.featured, p.body
  ORDER BY p.published_at DESC, p.id DESC
`;

const allPublishedPostsSql = `
  /* content:posts */
  SELECT ${publishedPostColumns}
  ${publishedPostJoins}
  ${publishedPostGroupAndOrder}
`;

const postsByTagSql = `
  /* content:posts-by-tag */
  SELECT ${publishedPostColumns}
  ${publishedPostJoins}
  WHERE EXISTS (
    SELECT 1
    FROM blog.post_tags AS selected_post_tag
    JOIN blog.tags AS selected_tag ON selected_tag.id = selected_post_tag.tag_id
    WHERE selected_post_tag.post_id = p.id
      AND selected_tag.slug = $1
  )
  ${publishedPostGroupAndOrder}
`;

const postsByCategorySql = `
  /* content:posts-by-category */
  SELECT ${publishedPostColumns}
  ${publishedPostJoins}
  WHERE c.slug = $1
  ${publishedPostGroupAndOrder}
`;

const searchPublishedPostsSql = `
  /* content:search-posts */
  SELECT ${publishedPostColumns}
  ${publishedPostJoins}
  WHERE p.title ILIKE $1 ESCAPE E'\\\\'
    OR p.excerpt ILIKE $1 ESCAPE E'\\\\'
    OR c.name ILIKE $1 ESCAPE E'\\\\'
    OR EXISTS (
      SELECT 1
      FROM blog.post_tags AS search_post_tag
      JOIN blog.tags AS search_tag ON search_tag.id = search_post_tag.tag_id
      WHERE search_post_tag.post_id = p.id
        AND search_tag.name ILIKE $1 ESCAPE E'\\\\'
    )
  ${publishedPostGroupAndOrder}
`;

const tagExistsSql = `
  /* content:tag-exists */
  SELECT slug, name
  FROM blog.tags
  WHERE slug = $1
  LIMIT 1
`;

const categoryExistsSql = `
  /* content:category-exists */
  SELECT slug, name
  FROM blog.categories
  WHERE slug = $1
  LIMIT 1
`;

interface Snapshot {
  readonly records: readonly PostRecord[];
  readonly summaries: readonly PostSummary[];
  readonly categories: readonly TaxonomySummary[];
  readonly tags: readonly TaxonomySummary[];
}

function escapeLike(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_");
}

export function createNeonContentRepository(
  executor: QueryExecutor,
): ContentRepository {
  async function loadDefinitions(): Promise<{
    categories: readonly TaxonomyDefinition[];
    tags: readonly TaxonomyDefinition[];
  }> {
    const [categoryRows, tagRows] = await Promise.all([
      executor.queryRows(categoryDefinitionsSql),
      executor.queryRows(tagDefinitionsSql),
    ]);
    return {
      categories: decodeTaxonomyRows(categoryRows),
      tags: decodeTaxonomyRows(tagRows),
    };
  }

  async function loadSnapshot(
    statement = allPublishedPostsSql,
    parameters: readonly unknown[] = [],
  ): Promise<Snapshot> {
    const [postRows, allPostRows, definitions] = await Promise.all([
      executor.queryRows(statement, parameters),
      statement === allPublishedPostsSql
        ? Promise.resolve<readonly unknown[] | null>(null)
        : executor.queryRows(allPublishedPostsSql),
      loadDefinitions(),
    ]);
    const records = decodePostRows(postRows);
    const allRecords = allPostRows ? decodePostRows(allPostRows) : records;
    const categories = createTaxonomySummaries(
      definitions.categories,
      allRecords,
      "category",
    );
    const tags = createTaxonomySummaries(definitions.tags, allRecords, "tag");
    return {
      records,
      summaries: createPostSummaries(records, categories, tags),
      categories,
      tags,
    };
  }

  async function loadAllSnapshot(): Promise<Snapshot> {
    return loadSnapshot();
  }

  async function hasTaxonomy(
    statement: string,
    slug: string,
  ): Promise<boolean> {
    const rows = await executor.queryRows(statement, [slug]);
    if (rows.length === 0) return false;
    decodeTaxonomyRows(rows);
    return true;
  }

  async function createStats(snapshot: Snapshot): Promise<SiteStats> {
    const archiveGroups = createArchiveGroups(snapshot.summaries);
    return {
      posts: snapshot.summaries.length,
      categories: snapshot.categories.filter((item) => item.count > 0).length,
      tags: snapshot.tags.filter((item) => item.count > 0).length,
      years: archiveGroups.length,
    };
  }

  return {
    async getSiteConfig() {
      const [siteRows, definitions] = await Promise.all([
        executor.queryRows(siteSql),
        loadDefinitions(),
      ]);
      if (siteRows.length !== 1) {
        throw new Error(`Expected one site configuration row, received ${siteRows.length}`);
      }
      return decodeSiteConfig(
        siteRows[0],
        definitions.categories,
        definitions.tags,
      );
    },
    async listPublishedPosts() {
      return (await loadAllSnapshot()).summaries;
    },
    async getRecentPosts(limit) {
      const snapshot = await loadAllSnapshot();
      return snapshot.summaries.slice(0, Math.max(0, limit));
    },
    async getPublishedPostBySlug(slug) {
      const snapshot = await loadAllSnapshot();
      const record = snapshot.records.find((post) => post.slug === slug);
      const summary = snapshot.summaries.find((post) => post.slug === slug);
      if (!record || !summary) return null;
      return createPostDetail(record, summary, snapshot.summaries);
    },
    async getArchiveGroups() {
      return createArchiveGroups((await loadAllSnapshot()).summaries);
    },
    async listTags() {
      return (await loadAllSnapshot()).tags;
    },
    async listPublishedPostsByTag(slug) {
      if (!(await hasTaxonomy(tagExistsSql, slug))) return null;
      return (await loadSnapshot(postsByTagSql, [slug])).summaries;
    },
    async listCategories() {
      return (await loadAllSnapshot()).categories;
    },
    async listPublishedPostsByCategory(slug) {
      if (!(await hasTaxonomy(categoryExistsSql, slug))) return null;
      return (await loadSnapshot(postsByCategorySql, [slug])).summaries;
    },
    async getSearchIndex() {
      return createSearchIndex((await loadAllSnapshot()).summaries);
    },
    async searchPublishedPosts(query) {
      const normalized = normalizeSearchText(query);
      if (!normalized) return [];
      const pattern = `%${escapeLike(normalized)}%`;
      const snapshot = await loadSnapshot(searchPublishedPostsSql, [pattern]);
      return searchDocuments(createSearchIndex(snapshot.summaries), normalized);
    },
    async getSiteStats() {
      return createStats(await loadAllSnapshot());
    },
    async getSidebarData() {
      const [site, snapshot] = await Promise.all([
        this.getSiteConfig(),
        loadAllSnapshot(),
      ]);
      const archiveGroups = createArchiveGroups(snapshot.summaries);
      return {
        site,
        recentPosts: snapshot.summaries.slice(0, 4),
        categories: snapshot.categories,
        tags: snapshot.tags,
        archiveGroups,
        stats: await createStats(snapshot),
      };
    },
  };
}

export const neonContentRepository = createNeonContentRepository({ queryRows });
