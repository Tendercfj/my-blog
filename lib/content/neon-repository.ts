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
    COALESCE(s.name, '我的博客') AS name,
    COALESCE(s.description, '记录设计、代码与日常观察。') AS description,
    COALESCE(s.site_url, 'https://tendercfj.cc.cd') AS site_url,
    COALESCE(s.logo_src, '/images/brand/logo.svg') AS logo_src,
    COALESCE(s.logo_alt, '博客标志') AS logo_alt,
    COALESCE(s.logo_width, 96) AS logo_width,
    COALESCE(s.logo_height, 96) AS logo_height,
    COALESCE(s.announcement, '') AS announcement,
    COALESCE(s.navigation, '[]'::jsonb) AS navigation,
    CASE
      WHEN p.name = '林屿' AND p.role = '独立开发者与设计爱好者'
        THEN split_part(o.email, '@', 1)
      ELSE COALESCE(p.name, split_part(o.email, '@', 1), '站长')
    END AS author_name,
    CASE
      WHEN p.name = '林屿' AND p.role = '独立开发者与设计爱好者' THEN '站长'
      ELSE COALESCE(p.role, '站长')
    END AS author_role,
    CASE
      WHEN p.name = '林屿' AND p.role = '独立开发者与设计爱好者' THEN ''
      ELSE COALESCE(p.bio, '')
    END AS author_bio,
    COALESCE(p.avatar_src, '/images/brand/avatar.svg') AS avatar_src,
    COALESCE(p.avatar_alt, '站长头像') AS avatar_alt,
    COALESCE(p.avatar_width, 240) AS avatar_width,
    COALESCE(p.avatar_height, 240) AS avatar_height,
    CASE
      WHEN p.name = '林屿' AND p.role = '独立开发者与设计爱好者' THEN '[]'::jsonb
      ELSE COALESCE(p.links, '[]'::jsonb)
    END AS author_links,
    CASE
      WHEN p.name = '林屿' AND p.role = '独立开发者与设计爱好者' THEN '{}'::jsonb
      ELSE COALESCE(p.about, '{}'::jsonb)
    END AS about
  FROM blog.owner_accounts AS o
  LEFT JOIN blog.site_settings AS s ON s.singleton_key = 1
  LEFT JOIN blog.author_profiles AS p ON p.account_id = o.id
  WHERE o.singleton_key = 1 AND o.is_enabled = true
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
        throw new Error(`Expected one owner/site configuration row, received ${siteRows.length}`);
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
