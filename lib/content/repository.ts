import "server-only";

import { posts } from "@/content/posts";
import { siteConfig } from "@/content/site";
import {
  createArchiveGroups,
  createPostDetail,
  createPostSummaries,
  createTaxonomySummaries,
} from "@/lib/content/derive";
import { createSearchIndex } from "@/lib/content/search";
import type {
  ArchiveYearGroup,
  PostDetail,
  PostSummary,
  SearchDocument,
  SidebarData,
  SiteConfig,
  SiteStats,
  TaxonomySummary,
} from "@/lib/content/types";
import { validateContent } from "@/lib/content/validate";

validateContent(siteConfig, posts);

const categories = createTaxonomySummaries(siteConfig.categories, posts, "category");
const tags = createTaxonomySummaries(siteConfig.tags, posts, "tag");
const summaries = createPostSummaries(posts, categories, tags);
const archiveGroups = createArchiveGroups(summaries);
const searchIndex = createSearchIndex(summaries);
const stats: SiteStats = {
  posts: summaries.length,
  categories: categories.filter((item) => item.count > 0).length,
  tags: tags.filter((item) => item.count > 0).length,
  years: archiveGroups.length,
};

export async function getSiteConfig(): Promise<SiteConfig> {
  return siteConfig;
}

export async function getAllPosts(): Promise<readonly PostSummary[]> {
  return summaries;
}

export async function getRecentPosts(limit: number): Promise<readonly PostSummary[]> {
  return summaries.slice(0, Math.max(0, limit));
}

export async function getPostBySlug(slug: string): Promise<PostDetail | null> {
  const record = posts.find((post) => post.slug === slug);
  const summary = summaries.find((post) => post.slug === slug);
  if (!record || !summary) return null;
  return createPostDetail(record, summary, summaries);
}

export async function getArchiveGroups(): Promise<readonly ArchiveYearGroup[]> {
  return archiveGroups;
}

export async function getAllTags(): Promise<readonly TaxonomySummary[]> {
  return tags;
}

export async function getPostsByTag(
  slug: string,
): Promise<readonly PostSummary[] | null> {
  if (!siteConfig.tags.some((tag) => tag.slug === slug)) return null;
  return summaries.filter((post) => post.tags.some((tag) => tag.slug === slug));
}

export async function getAllCategories(): Promise<readonly TaxonomySummary[]> {
  return categories;
}

export async function getPostsByCategory(
  slug: string,
): Promise<readonly PostSummary[] | null> {
  if (!siteConfig.categories.some((category) => category.slug === slug)) return null;
  return summaries.filter((post) => post.category.slug === slug);
}

export async function getSearchIndex(): Promise<readonly SearchDocument[]> {
  return searchIndex;
}

export async function getSiteStats(): Promise<SiteStats> {
  return stats;
}

export async function getSidebarData(): Promise<SidebarData> {
  return {
    site: siteConfig,
    recentPosts: summaries.slice(0, 4),
    categories,
    tags,
    archiveGroups,
    stats,
  };
}
