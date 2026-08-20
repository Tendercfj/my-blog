import "server-only";

import { z } from "zod";

import { ApiProblem } from "@/lib/api/problem";
import {
  contentBlockSchema,
  type OwnerPostCreateInput,
  type OwnerPostUpdateInput,
} from "@/lib/content/schemas";
import type { QueryExecutor } from "@/lib/content/contracts";
import type {
  ContentBlock,
  LocalImage,
  OwnerPost,
  PostStatus,
  TaxonomyDefinition,
} from "@/lib/content/types";
import { queryRows } from "@/lib/db/runtime";

const ownerPostRowSchema = z.object({
  id: z.string(),
  owner_id: z.string(),
  version: z.coerce.number().int().positive(),
  status: z.enum(["draft", "published", "archived"]),
  deleted_at: z.coerce.date().nullable(),
  slug: z.string().nullable(),
  title: z.string(),
  excerpt: z.string().nullable(),
  category_slug: z.string().nullable(),
  category_name: z.string().nullable(),
  tags: z.unknown(),
  cover_src: z.string().nullable(),
  cover_alt: z.string().nullable(),
  cover_width: z.coerce.number().int().positive().nullable(),
  cover_height: z.coerce.number().int().positive().nullable(),
  featured: z.boolean(),
  body: z.unknown(),
  published_at: z.coerce.date().nullable(),
  row_updated_at: z.coerce.date(),
});

function jsonValue(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

function toOwnerPost(row: unknown): OwnerPost {
  const parsed = ownerPostRowSchema.parse(row);
  const tagsRaw = z.array(z.object({ slug: z.string(), name: z.string() })).parse(jsonValue(parsed.tags));
  const body = z.array(contentBlockSchema).parse(jsonValue(parsed.body)) as readonly ContentBlock[];
  const category: TaxonomyDefinition | null =
    parsed.category_slug && parsed.category_name
      ? { slug: parsed.category_slug, name: parsed.category_name }
      : null;
  const cover =
    parsed.cover_src && parsed.cover_alt && parsed.cover_width && parsed.cover_height
      ? {
          src: parsed.cover_src as `/images/${string}` | `https://assets.tendercfj.cc.cd/${string}`,
          alt: parsed.cover_alt,
          width: parsed.cover_width,
          height: parsed.cover_height,
        }
      : null;
  return {
    id: parsed.id,
    ownerId: parsed.owner_id,
    version: parsed.version,
    status: parsed.status as PostStatus,
    deletedAt: parsed.deleted_at?.toISOString() ?? null,
    slug: parsed.slug,
    title: parsed.title,
    excerpt: parsed.excerpt,
    category,
    tags: tagsRaw,
    cover,
    featured: parsed.featured,
    body,
    publishedAt: parsed.published_at?.toISOString() ?? null,
    updatedAt: parsed.row_updated_at.toISOString(),
  };
}

const ownerPostSelect = `
  p.id::text AS id,
  p.owner_id::text AS owner_id,
  p.version,
  p.status,
  p.deleted_at,
  p.slug,
  p.title,
  p.excerpt,
  c.slug AS category_slug,
  c.name AS category_name,
  COALESCE(
    jsonb_agg(jsonb_build_object('slug', t.slug, 'name', t.name) ORDER BY pt.created_at, t.slug)
      FILTER (WHERE t.id IS NOT NULL), '[]'::jsonb
  ) AS tags,
  p.cover_src,
  p.cover_alt,
  p.cover_width,
  p.cover_height,
  p.featured,
  p.body,
  p.published_at,
  p.row_updated_at
`;

const ownerPostFrom = `
  FROM blog.posts AS p
  LEFT JOIN blog.categories AS c ON c.id = p.category_id
  LEFT JOIN blog.post_tags AS pt ON pt.post_id = p.id
  LEFT JOIN blog.tags AS t ON t.id = pt.tag_id
`;

export interface OwnerPostListFilters {
  readonly status?: "published" | "draft" | "archived" | "all";
}

function versionConflict() {
  return new ApiProblem(
    409,
    "VERSION_CONFLICT",
    "文章已被其他操作更新，请刷新后重试",
  );
}

function assertPublishable(
  input: {
    readonly slug: string;
    readonly excerpt: string | null;
    readonly category: string | null;
    readonly cover: LocalImage | null;
    readonly body: readonly ContentBlock[];
  },
) {
  if (
    !input.slug ||
    !input.excerpt?.trim() ||
    !input.category ||
    !input.cover ||
    input.body.length === 0
  ) {
    throw new ApiProblem(
      422,
      "VALIDATION_FAILED",
      "发布文章必须包含 slug、摘要、分类、封面和正文",
    );
  }
}

export function createOwnerContentRepository(executor: QueryExecutor) {
  async function listOwnerPosts(accountId: string, filters: OwnerPostListFilters = {}) {
    const status = filters.status ?? "published";
    const params: unknown[] = [accountId];
    const statusClause = status === "all" ? "" : "AND p.status = $2";
    if (status !== "all") params.push(status);
    const rows = await executor.queryRows(
      `SELECT ${ownerPostSelect} ${ownerPostFrom}
       WHERE p.owner_id = $1 AND p.deleted_at IS NULL ${statusClause}
       GROUP BY p.id, c.slug, c.name
       ORDER BY COALESCE(p.published_at, p.row_updated_at) DESC, p.id DESC`,
      params,
    );
    return rows.map(toOwnerPost);
  }

  async function getOwnerPostById(accountId: string, id: string) {
    const rows = await executor.queryRows(
      `SELECT ${ownerPostSelect} ${ownerPostFrom}
       WHERE p.owner_id = $1 AND p.id = $2 AND p.deleted_at IS NULL
       GROUP BY p.id, c.slug, c.name
       LIMIT 1`,
      [accountId, id],
    );
    return rows.length ? toOwnerPost(rows[0]) : null;
  }

  async function createOwnerPost(
    accountId: string,
    input: OwnerPostCreateInput,
    requestId: string,
  ) {
    const uniqueTags = [...new Set(input.tags)];
    if (uniqueTags.length !== input.tags.length) {
      throw new ApiProblem(422, "VALIDATION_FAILED", "标签不能重复", [
        { field: "tags", reason: "CUSTOM", message: "标签不能重复" },
      ]);
    }
    const rows = await executor.queryRows(
      `
      WITH candidate AS (
        SELECT $1::uuid AS owner_id
        WHERE NOT EXISTS (SELECT 1 FROM blog.posts WHERE slug = $2)
      ),
      ensured_category AS (
        INSERT INTO blog.categories (slug, name)
        SELECT $5, $5 FROM candidate WHERE $5::text IS NOT NULL
        ON CONFLICT (slug) DO NOTHING
        RETURNING id, slug
      ),
      resolved_category AS (
        SELECT id, slug FROM blog.categories WHERE slug = $5
        UNION ALL
        SELECT id, slug FROM ensured_category
      ),
      ensured_tags AS (
        INSERT INTO blog.tags (slug, name)
        SELECT tag.slug, tag.slug
        FROM candidate
        CROSS JOIN unnest($12::text[]) AS tag(slug)
        ON CONFLICT (slug) DO NOTHING
        RETURNING id, slug
      ),
      resolved_tags AS (
        SELECT id, slug FROM blog.tags WHERE slug = ANY($12::text[])
        UNION ALL
        SELECT id, slug FROM ensured_tags
      ),
      created AS (
        INSERT INTO blog.posts (
          owner_id, slug, title, excerpt, category_id,
          cover_src, cover_alt, cover_width, cover_height,
          featured, body
        )
        SELECT
          candidate.owner_id, $2, $3, $4,
          (SELECT id FROM resolved_category LIMIT 1),
          $6, $7, $8, $9, $10, $11::jsonb
        FROM candidate
        ON CONFLICT DO NOTHING
        RETURNING id, version
      ),
      added_tags AS (
        INSERT INTO blog.post_tags (post_id, tag_id)
        SELECT created.id, resolved_tags.id
        FROM created
        CROSS JOIN resolved_tags
        ON CONFLICT (post_id, tag_id) DO NOTHING
        RETURNING post_id
      ),
      audited AS (
        INSERT INTO blog.post_audit_events (
          actor_account_id, post_id, action, request_id, changes
        )
        SELECT $1, created.id, 'create', $13::uuid,
          jsonb_build_object(
            'version', created.version,
            'fields', ARRAY['slug','title','excerpt','category','tags','cover','featured','body']
          )
        FROM created
        RETURNING post_id
      )
      SELECT id, version FROM created
      `,
      [
        accountId,
        input.slug,
        input.title,
        input.excerpt,
        input.category,
        input.cover?.src ?? null,
        input.cover?.alt ?? null,
        input.cover?.width ?? null,
        input.cover?.height ?? null,
        input.featured,
        JSON.stringify(input.body),
        uniqueTags,
        requestId,
      ],
    );
    if (!rows.length) {
      throw new ApiProblem(409, "SLUG_CONFLICT", "文章 slug 已被使用");
    }
    const post = await getOwnerPostById(accountId, String((rows[0] as { id: unknown }).id));
    if (!post) throw new Error("Created owner post could not be read back");
    return post;
  }

  async function updateOwnerPost(
    accountId: string,
    id: string,
    expectedVersion: number,
    input: OwnerPostUpdateInput,
    requestId: string,
  ) {
    const current = await getOwnerPostById(accountId, id);
    if (!current) throw new ApiProblem(404, "RESOURCE_NOT_FOUND", "文章不存在");
    if (current.version !== expectedVersion) {
      throw versionConflict();
    }
    if (current.publishedAt && input.slug !== current.slug) {
      throw new ApiProblem(
        422,
        "VALIDATION_FAILED",
        "文章发布后 slug 不能修改",
        [{ field: "slug", reason: "IMMUTABLE", message: "文章发布后 slug 不能修改" }],
      );
    }
    if (current.status === "published") {
      assertPublishable(input);
    }

    const uniqueTags = [...new Set(input.tags)];
    if (uniqueTags.length !== input.tags.length) {
      throw new ApiProblem(422, "VALIDATION_FAILED", "标签不能重复", [
        { field: "tags", reason: "CUSTOM", message: "标签不能重复" },
      ]);
    }
    if (input.slug !== current.slug) {
      const conflictingRows = await executor.queryRows(
        "SELECT 1 FROM blog.posts WHERE slug = $1 AND id <> $2 LIMIT 1",
        [input.slug, id],
      );
      if (conflictingRows.length) {
        throw new ApiProblem(409, "SLUG_CONFLICT", "文章 slug 已被使用");
      }
    }

    const cover = input.cover;
    const rows = await executor.queryRows(
      `
      WITH eligible AS (
        SELECT id
        FROM blog.posts
        WHERE id = $1 AND owner_id = $2 AND version = $3 AND deleted_at IS NULL
      ),
      ensured_category AS (
        INSERT INTO blog.categories (slug, name)
        SELECT $7, $7 FROM eligible WHERE $7::text IS NOT NULL
        ON CONFLICT (slug) DO NOTHING
        RETURNING id, slug
      ),
      resolved_category AS (
        SELECT id, slug FROM blog.categories WHERE slug = $7
        UNION ALL
        SELECT id, slug FROM ensured_category
      ),
      ensured_tags AS (
        INSERT INTO blog.tags (slug, name)
        SELECT tag.slug, tag.slug
        FROM eligible
        CROSS JOIN unnest($14::text[]) AS tag(slug)
        ON CONFLICT (slug) DO NOTHING
        RETURNING id, slug
      ),
      resolved_tags AS (
        SELECT id, slug FROM blog.tags WHERE slug = ANY($14::text[])
        UNION ALL
        SELECT id, slug FROM ensured_tags
      ),
      updated AS (
        UPDATE blog.posts AS p
        SET
          slug = $4,
          title = $5,
          excerpt = $6,
          category_id = (SELECT id FROM resolved_category LIMIT 1),
          cover_src = $8,
          cover_alt = $9,
          cover_width = $10,
          cover_height = $11,
          featured = $12,
          body = $13::jsonb,
          content_updated_at = CASE WHEN p.status = 'published' THEN clock_timestamp() ELSE p.content_updated_at END
        FROM eligible
        WHERE p.id = eligible.id
        RETURNING p.id, p.version
      ),
      removed_tags AS (
        DELETE FROM blog.post_tags
        WHERE post_id IN (SELECT id FROM updated)
        RETURNING post_id
      ),
      added_tags AS (
        INSERT INTO blog.post_tags (post_id, tag_id)
        SELECT updated.id, resolved_tags.id
        FROM updated
        CROSS JOIN resolved_tags
        CROSS JOIN (SELECT count(*) FROM removed_tags) AS removal_barrier
        ON CONFLICT (post_id, tag_id) DO NOTHING
        RETURNING post_id
      ),
      audited AS (
        INSERT INTO blog.post_audit_events (actor_account_id, post_id, action, request_id, changes)
        SELECT $2, updated.id, 'update', $15::uuid,
          jsonb_build_object('version', updated.version, 'fields', ARRAY['slug','title','excerpt','category','tags','cover','featured','body'])
        FROM updated
        RETURNING post_id
      )
      SELECT id, version FROM updated
      `,
      [
        id,
        accountId,
        expectedVersion,
        input.slug,
        input.title,
        input.excerpt,
        input.category,
        cover?.src ?? null,
        cover?.alt ?? null,
        cover?.width ?? null,
        cover?.height ?? null,
        input.featured,
        JSON.stringify(input.body),
        uniqueTags,
        requestId,
      ],
    );
    if (!rows.length) {
      throw versionConflict();
    }
    return getOwnerPostById(accountId, id);
  }

  async function publishOwnerPost(
    accountId: string,
    id: string,
    expectedVersion: number,
    requestId: string,
  ) {
    const current = await getOwnerPostById(accountId, id);
    if (!current) throw new ApiProblem(404, "RESOURCE_NOT_FOUND", "文章不存在");
    if (current.version !== expectedVersion) throw versionConflict();
    if (current.status !== "draft") {
      throw new ApiProblem(409, "INVALID_POST_STATE", "只有草稿可以发布");
    }
    assertPublishable({
      slug: current.slug ?? "",
      excerpt: current.excerpt,
      category: current.category?.slug ?? null,
      cover: current.cover,
      body: current.body,
    });

    const rows = await executor.queryRows(
      `
      WITH published AS (
        UPDATE blog.posts AS p
        SET
          status = 'published',
          published_at = COALESCE(p.published_at, clock_timestamp()),
          content_updated_at = COALESCE(p.content_updated_at, clock_timestamp())
        WHERE
          p.id = $1
          AND p.owner_id = $2
          AND p.version = $3
          AND p.status = 'draft'
          AND p.deleted_at IS NULL
        RETURNING p.id, p.version
      ),
      audited AS (
        INSERT INTO blog.post_audit_events (
          actor_account_id, post_id, action, request_id, changes
        )
        SELECT $2, published.id, 'publish', $4::uuid,
          jsonb_build_object('version', published.version, 'status', 'published')
        FROM published
        RETURNING post_id
      )
      SELECT id, version FROM published
      `,
      [id, accountId, expectedVersion, requestId],
    );
    if (!rows.length) throw versionConflict();
    const post = await getOwnerPostById(accountId, id);
    if (!post) throw new Error("Published owner post could not be read back");
    return post;
  }

  return {
    listOwnerPosts,
    getOwnerPostById,
    createOwnerPost,
    updateOwnerPost,
    publishOwnerPost,
  };
}

export const ownerContentRepository = createOwnerContentRepository({ queryRows });

export const listOwnerPosts = ownerContentRepository.listOwnerPosts;
export const getOwnerPostById = ownerContentRepository.getOwnerPostById;
export const createOwnerPost = ownerContentRepository.createOwnerPost;
export const updateOwnerPost = ownerContentRepository.updateOwnerPost;
export const publishOwnerPost = ownerContentRepository.publishOwnerPost;
