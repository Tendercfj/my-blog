import "server-only";

import { existsSync } from "node:fs";
import { join } from "node:path";

import type {
  ContentBlock,
  LocalImage,
  PostRecord,
  SiteConfig,
} from "@/lib/content/types";

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`[content] ${message}`);
  }
}

function isValidDate(value: string): boolean {
  if (!datePattern.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().startsWith(value);
}

function validateImage(image: LocalImage, owner: string): void {
  assert(image.src.startsWith("/images/"), `${owner}: image must use /images/: ${image.src}`);
  assert(image.alt.trim().length > 0, `${owner}: informative image needs alt text`);
  assert(image.width > 0 && image.height > 0, `${owner}: image dimensions must be positive`);
  const filePath = join(process.cwd(), "public", image.src.slice(1));
  assert(existsSync(filePath), `${owner}: local image does not exist: ${image.src}`);
}

function validateLink(href: string, owner: string): void {
  if (href.startsWith("/")) return;
  const url = new URL(href);
  assert(["https:", "mailto:"].includes(url.protocol), `${owner}: unsupported link protocol`);
}

function validateBlocks(blocks: readonly ContentBlock[], slug: string): void {
  assert(blocks.length > 0, `${slug}: body cannot be empty`);
  const headingIds = new Set<string>();

  for (const block of blocks) {
    switch (block.type) {
      case "heading":
        assert(block.text.trim(), `${slug}: heading text cannot be empty`);
        assert(slugPattern.test(block.id), `${slug}: invalid heading id ${block.id}`);
        assert(!headingIds.has(block.id), `${slug}: duplicate heading id ${block.id}`);
        headingIds.add(block.id);
        break;
      case "paragraph":
        assert(block.children.length > 0, `${slug}: paragraph cannot be empty`);
        for (const child of block.children) {
          assert(child.value.trim(), `${slug}: inline content cannot be empty`);
          if (child.type === "link") validateLink(child.href, slug);
        }
        break;
      case "list":
        assert(block.items.length > 0, `${slug}: list cannot be empty`);
        assert(block.items.every((item) => item.trim()), `${slug}: list item cannot be empty`);
        break;
      case "quote":
        assert(block.text.trim(), `${slug}: quote cannot be empty`);
        break;
      case "image":
        validateImage(block.image, slug);
        break;
      case "code":
        assert(block.language.trim() && block.code.trim(), `${slug}: code block cannot be empty`);
        break;
    }
  }
}

function validateDefinitions(
  values: readonly { slug: string; name: string }[],
  owner: string,
): Set<string> {
  const slugs = new Set<string>();
  for (const value of values) {
    assert(slugPattern.test(value.slug), `${owner}: invalid slug ${value.slug}`);
    assert(value.name.trim(), `${owner}: name cannot be empty`);
    assert(!slugs.has(value.slug), `${owner}: duplicate slug ${value.slug}`);
    slugs.add(value.slug);
  }
  return slugs;
}

export function validateContent(site: SiteConfig, posts: readonly PostRecord[]): void {
  assert(site.name.trim() && site.description.trim(), "site name and description are required");
  const siteUrl = new URL(site.siteUrl);
  if (process.env.VERCEL_ENV === "production") {
    assert(siteUrl.protocol === "https:", "production site URL must use https");
  }
  validateImage(site.logo, "site logo");
  validateImage(site.author.avatar, "author avatar");

  const categorySlugs = validateDefinitions(site.categories, "categories");
  const tagSlugs = validateDefinitions(site.tags, "tags");
  const postSlugs = new Set<string>();

  for (const post of posts) {
    assert(slugPattern.test(post.slug), `invalid post slug ${post.slug}`);
    assert(!postSlugs.has(post.slug), `duplicate post slug ${post.slug}`);
    postSlugs.add(post.slug);
    assert(post.title.trim() && post.excerpt.trim(), `${post.slug}: title and excerpt are required`);
    assert(isValidDate(post.publishedAt), `${post.slug}: invalid publishedAt`);
    if (post.updatedAt) {
      assert(isValidDate(post.updatedAt), `${post.slug}: invalid updatedAt`);
      assert(post.updatedAt >= post.publishedAt, `${post.slug}: updatedAt precedes publishedAt`);
    }
    assert(categorySlugs.has(post.category), `${post.slug}: unknown category ${post.category}`);
    assert(post.tags.length > 0, `${post.slug}: at least one tag is required`);
    for (const tag of post.tags) {
      assert(tagSlugs.has(tag), `${post.slug}: unknown tag ${tag}`);
    }
    validateImage(post.cover, post.slug);
    validateBlocks(post.body, post.slug);
  }

  for (const link of [...site.author.links, ...site.navigation]) {
    validateLink(link.href, `site link ${link.label}`);
  }
}
