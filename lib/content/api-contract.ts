import { z } from "zod";

import { parseApiInput } from "@/lib/api/validation";
import { contentSlugSchema } from "@/lib/content/slug";
import { ownerPostUpdateSchema } from "@/lib/content/schemas";
import type { IsoDate } from "@/lib/content/types";

const integerQuery = (minimum: number, maximum: number) =>
  z
    .string()
    .regex(/^\d+$/, "必须是整数")
    .transform(Number)
    .pipe(z.number().int().min(minimum).max(maximum));

const cursorQuery = z.string().optional();

export const emptyQuerySchema = z.object({}).strict();

export const paginationQuerySchema = z
  .object({
    limit: integerQuery(1, 100).default(20),
    cursor: cursorQuery,
  })
  .strict();

export const postsQuerySchema = paginationQuerySchema
  .extend({
    featured: z
      .enum(["true", "false"])
      .transform((value) => value === "true")
      .optional(),
  })
  .strict();

export const searchQuerySchema = paginationQuerySchema
  .extend({
    q: z.string().transform((value) => value.normalize("NFKC").trim()).pipe(
      z.string().min(1, "请输入搜索关键词").max(100, "搜索关键词不能超过 100 个字符"),
    ),
  })
  .strict();

export const sidebarQuerySchema = z
  .object({
    recentLimit: integerQuery(0, 20).default(4),
  })
  .strict();

export const ownerPostsQuerySchema = z
  .object({
    status: z.enum(["published", "draft", "archived", "all"]).default("published"),
  })
  .strict();

export const ownerPostIdSchema = z.string().uuid();
export const ownerPostPatchSchema = ownerPostUpdateSchema;

export const slugPathSchema = contentSlugSchema;

export function parseSearchParams<T>(
  searchParams: URLSearchParams,
  schema: z.ZodType<T>,
): T {
  const input: Record<string, string | string[]> = {};
  for (const key of new Set(searchParams.keys())) {
    const values = searchParams.getAll(key);
    input[key] = values.length === 1 ? values[0] : values;
  }
  return parseApiInput(schema, input);
}

export const searchDocumentSchema = z.object({
  slug: z.string(),
  title: z.string(),
  excerpt: z.string(),
  category: z.string(),
  tags: z.array(z.string()),
  publishedAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .transform((value) => value as IsoDate),
});

export const searchSuccessEnvelopeSchema = z.object({
  data: z.array(searchDocumentSchema),
  pageInfo: z.object({
    nextCursor: z.string().nullable(),
    hasNextPage: z.boolean(),
  }),
  meta: z.object({ requestId: z.string() }),
});

export const apiErrorEnvelopeSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    requestId: z.string(),
    details: z
      .array(
        z.object({
          field: z.string().optional(),
          reason: z.string(),
          message: z.string(),
        }),
      )
      .optional(),
  }),
});

export type SearchSuccessEnvelope = z.infer<
  typeof searchSuccessEnvelopeSchema
>;
