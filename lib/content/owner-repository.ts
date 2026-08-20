import "server-only";

import { z } from "zod";

import { ApiProblem } from "@/lib/api/problem";
import { contentBlockSchema, type OwnerPostUpdateInput } from "@/lib/content/schemas";
import type { QueryExecutor } from "@/lib/content/contracts";
import type { ContentBlock, OwnerPost, PostStatus, TaxonomyDefinition } from "@/lib/content/types";
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
       WHERE p.owner_id = $1 AND p.id = $2
       GROUP BY p.id, c.slug, c.name
       LIMIT 1`,
      [accountId, id],
    );
    return rows.length ? toOwnerPost(rows[0]) : null;
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
      throw new ApiProblem(409, "VERSION_CONFLICT", "文章已被其他操作更新，请刷新后重试");
    }
    if (current.status === "published" && (!input.excerpt?.trim() || !input.category || !input.cover || input.body.length === 0)) {
      throw new ApiProblem(422, "VALIDATION_FAILED", "已发布文章必须包含摘要、分类、封面和正文");
    }

    if (input.category) {
      const categoryRows = await executor.queryRows(
        "SELECT 1 FROM blog.categories WHERE slug = $1 LIMIT 1",
        [input.category],
      );
      if (!categoryRows.length) {
        throw new ApiProblem(422, "VALIDATION_FAILED", "分类不存在", [
          { field: "category", reason: "CUSTOM", message: "分类不存在" },
        ]);
      }
    }

    const uniqueTags = [...new Set(input.tags)];
    if (uniqueTags.length !== input.tags.length) {
      throw new ApiProblem(422, "VALIDATION_FAILED", "标签不能重复", [
        { field: "tags", reason: "CUSTOM", message: "标签不能重复" },
      ]);
    }
    if (uniqueTags.length) {
      const tagRows = await executor.queryRows(
        "SELECT slug FROM blog.tags WHERE slug = ANY($1::text[])",
        [uniqueTags],
      );
      if (tagRows.length !== uniqueTags.length) {
        throw new ApiProblem(422, "VALIDATION_FAILED", "存在不存在的标签", [
          { field: "tags", reason: "CUSTOM", message: "存在不存在的标签" },
        ]);
      }
    }
    const cover = input.cover;
    const rows = await executor.queryRows(
      `
      WITH updated AS (
        UPDATE blog.posts AS p
        SET
          title = $4,
          excerpt = $5,
          category_id = (SELECT id FROM blog.categories WHERE slug = $6),
          cover_src = $7,
          cover_alt = $8,
          cover_width = $9,
          cover_height = $10,
          featured = $11,
          body = $12::jsonb,
          content_updated_at = CASE WHEN p.status = 'published' THEN clock_timestamp() ELSE p.content_updated_at END
        WHERE p.id = $1 AND p.owner_id = $2 AND p.version = $3
        RETURNING p.id, p.version
      ),
      removed_tags AS (
        DELETE FROM blog.post_tags
        WHERE post_id IN (SELECT id FROM updated)
        RETURNING post_id
      ),
      added_tags AS (
        INSERT INTO blog.post_tags (post_id, tag_id)
        SELECT updated.id, tags.id
        FROM updated
        JOIN blog.tags AS tags ON tags.slug = ANY($13::text[])
        ON CONFLICT (post_id, tag_id) DO NOTHING
        RETURNING post_id
      ),
      audited AS (
        INSERT INTO blog.post_audit_events (actor_account_id, post_id, action, request_id, changes)
        SELECT $2, updated.id, 'update', $14::uuid,
          jsonb_build_object('version', updated.version, 'fields', ARRAY['title','excerpt','category','tags','cover','featured','body'])
        FROM updated
        RETURNING post_id
      )
      SELECT id, version FROM updated
      `,
      [
        id,
        accountId,
        expectedVersion,
        input.title,
        input.excerpt,
        input.category,
        cover?.src ?? null,
        cover?.alt ?? null,
        cover?.width ?? null,
        cover?.height ?? null,
        input.featured,
        JSON.stringify(input.body),
        input.tags,
        requestId,
      ],
    );
    if (!rows.length) {
      throw new ApiProblem(409, "VERSION_CONFLICT", "文章已被其他操作更新，请刷新后重试");
    }
    return getOwnerPostById(accountId, id);
  }

  return { listOwnerPosts, getOwnerPostById, updateOwnerPost };
}

export const ownerContentRepository = createOwnerContentRepository({ queryRows });

export const listOwnerPosts = ownerContentRepository.listOwnerPosts;
export const getOwnerPostById = ownerContentRepository.getOwnerPostById;
export const updateOwnerPost = ownerContentRepository.updateOwnerPost;
