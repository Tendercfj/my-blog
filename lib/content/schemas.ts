import { z } from "zod";

import { contentSlugSchema } from "@/lib/content/slug";
import type {
  AboutContent,
  ContentBlock,
  ImageSource,
  IsoDate,
  PostRecord,
  SiteConfig,
  TaxonomyDefinition,
} from "@/lib/content/types";

const nonBlankStringSchema = z
  .string()
  .refine((value) => value.trim().length > 0, "Value cannot be blank");

const linkSchema = z.string().min(1).refine((value) => {
  if (value.startsWith("/")) return true;
  try {
    return ["https:", "mailto:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}, "Unsupported link protocol");

const imageSourceSchema = z
  .string()
  .refine(
    (value) =>
      value.startsWith("/images/") ||
      value.startsWith("https://assets.tendercfj.cc.cd/"),
    "Unsupported image source",
  )
  .transform((value) => value as ImageSource);

const imageSchema = z.object({
  src: imageSourceSchema,
  alt: z.string().trim().min(1),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});

const inlineContentSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("text"), value: nonBlankStringSchema }),
  z.object({
    type: z.literal("link"),
    value: nonBlankStringSchema,
    href: linkSchema,
    external: z.boolean().optional(),
  }),
  z.object({ type: z.literal("code"), value: nonBlankStringSchema }),
]);

export const contentBlockSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("heading"),
    level: z.union([z.literal(2), z.literal(3)]),
    id: contentSlugSchema,
    text: nonBlankStringSchema,
  }),
  z.object({
    type: z.literal("paragraph"),
    children: z.array(inlineContentSchema).min(1),
  }),
  z.object({
    type: z.literal("list"),
    ordered: z.boolean(),
    items: z.array(nonBlankStringSchema).min(1),
  }),
  z.object({
    type: z.literal("quote"),
    text: nonBlankStringSchema,
    cite: z.string().optional(),
  }),
  z.object({
    type: z.literal("image"),
    image: imageSchema,
    caption: z.string().optional(),
  }),
  z.object({
    type: z.literal("code"),
    language: nonBlankStringSchema,
    code: nonBlankStringSchema,
  }),
]);

export const contentBlocksSchema = z
  .array(contentBlockSchema)
  .min(1)
  .superRefine((blocks, context) => {
    const ids = new Set<string>();
    for (const block of blocks) {
      if (block.type !== "heading") continue;
      if (ids.has(block.id)) {
        context.addIssue({
          code: "custom",
          message: `Duplicate heading id: ${block.id}`,
        });
      }
      ids.add(block.id);
    }
  });

export const ownerPostUpdateSchema = z.object({
  version: z.number().int().positive(),
  title: nonBlankStringSchema.max(240),
  excerpt: z.string().trim().max(1000).nullable(),
  category: contentSlugSchema.nullable(),
  tags: z.array(contentSlugSchema).max(30),
  cover: imageSchema.nullable(),
  featured: z.boolean(),
  body: contentBlocksSchema,
}).strict();

export type OwnerPostUpdateInput = z.infer<typeof ownerPostUpdateSchema>;

const navigationSchema = z.array(
  z.object({ href: linkSchema, label: nonBlankStringSchema }),
);

const authorLinksSchema = z.array(
  z.object({ label: nonBlankStringSchema, href: linkSchema }),
);

const aboutSchema: z.ZodType<AboutContent> = z.object({
  greeting: z.string().default("你好"),
  title: z.string().default("关于我"),
  summary: z.string().default(""),
  skills: z.array(z.string()).default([]),
  facts: z.array(z.object({ value: z.string(), label: z.string() })).default([]),
  sections: z.array(z.object({ title: z.string(), body: z.string() })).default([]),
});

function decodeJson(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

const jsonSchema = <T>(schema: z.ZodType<T>) => z.preprocess(decodeJson, schema);

const databaseDateSchema = z
  .union([z.date(), z.string().min(1)])
  .transform((value, context) => {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.valueOf())) {
      context.addIssue({ code: "custom", message: "Invalid database date" });
      return z.NEVER;
    }
    return date.toISOString().slice(0, 10) as IsoDate;
  });

const siteRowSchema = z.object({
  name: nonBlankStringSchema,
  description: nonBlankStringSchema,
  site_url: z.url({ protocol: /^https?$/ }),
  logo_src: imageSourceSchema,
  logo_alt: nonBlankStringSchema,
  logo_width: z.coerce.number().int().positive(),
  logo_height: z.coerce.number().int().positive(),
  announcement: z.string(),
  navigation: jsonSchema(navigationSchema),
  author_name: nonBlankStringSchema,
  author_role: z.string(),
  author_bio: z.string(),
  avatar_src: imageSourceSchema,
  avatar_alt: nonBlankStringSchema,
  avatar_width: z.coerce.number().int().positive(),
  avatar_height: z.coerce.number().int().positive(),
  author_links: jsonSchema(authorLinksSchema),
  about: jsonSchema(aboutSchema),
});

const taxonomyRowSchema = z.object({
  slug: contentSlugSchema,
  name: nonBlankStringSchema,
});

const postRowSchema = z.object({
  slug: contentSlugSchema,
  title: nonBlankStringSchema,
  excerpt: nonBlankStringSchema,
  published_at: databaseDateSchema,
  content_updated_at: databaseDateSchema.nullable().optional(),
  category_slug: contentSlugSchema,
  tags: jsonSchema(z.array(contentSlugSchema)),
  cover_src: imageSourceSchema,
  cover_alt: nonBlankStringSchema,
  cover_width: z.coerce.number().int().positive(),
  cover_height: z.coerce.number().int().positive(),
  featured: z.boolean(),
  body: jsonSchema(contentBlocksSchema),
});

export function decodeTaxonomyRows(
  rows: readonly unknown[],
): readonly TaxonomyDefinition[] {
  return rows.map((row) => taxonomyRowSchema.parse(row));
}

export function decodePostRows(rows: readonly unknown[]): readonly PostRecord[] {
  return rows.map((row): PostRecord => {
    const parsed = postRowSchema.parse(row);
    return {
      slug: parsed.slug,
      title: parsed.title,
      excerpt: parsed.excerpt,
      publishedAt: parsed.published_at,
      updatedAt: parsed.content_updated_at ?? undefined,
      category: parsed.category_slug,
      tags: parsed.tags,
      cover: {
        src: parsed.cover_src,
        alt: parsed.cover_alt,
        width: parsed.cover_width,
        height: parsed.cover_height,
      },
      featured: parsed.featured,
      body: parsed.body as readonly ContentBlock[],
    };
  });
}

export function decodeSiteConfig(
  row: unknown,
  categories: readonly TaxonomyDefinition[],
  tags: readonly TaxonomyDefinition[],
): SiteConfig {
  const parsed = siteRowSchema.parse(row);
  return {
    name: parsed.name,
    description: parsed.description,
    siteUrl: parsed.site_url,
    logo: {
      src: parsed.logo_src,
      alt: parsed.logo_alt,
      width: parsed.logo_width,
      height: parsed.logo_height,
    },
    author: {
      name: parsed.author_name,
      role: parsed.author_role,
      bio: parsed.author_bio,
      avatar: {
        src: parsed.avatar_src,
        alt: parsed.avatar_alt,
        width: parsed.avatar_width,
        height: parsed.avatar_height,
      },
      links: parsed.author_links,
    },
    announcement: parsed.announcement,
    navigation: parsed.navigation,
    categories,
    tags,
    about: parsed.about,
  };
}
