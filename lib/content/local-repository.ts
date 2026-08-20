import { posts as defaultPosts } from "@/content/posts";
import { siteConfig as defaultSiteConfig } from "@/content/site";
import type { ContentRepository } from "@/lib/content/contracts";
import {
  createArchiveGroups,
  createPostDetail,
  createPostSummaries,
  createTaxonomySummaries,
} from "@/lib/content/derive";
import { createSearchIndex, searchDocuments } from "@/lib/content/search";
import type { PostRecord, SiteConfig, SiteStats } from "@/lib/content/types";
import { validateContent } from "@/lib/content/validate";

export function createLocalContentRepository(
  siteConfig: SiteConfig,
  posts: readonly PostRecord[],
): ContentRepository {
  validateContent(siteConfig, posts);

  const categories = createTaxonomySummaries(
    siteConfig.categories,
    posts,
    "category",
  );
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

  return {
    async getSiteConfig() {
      return siteConfig;
    },
    async listPublishedPosts() {
      return summaries;
    },
    async getRecentPosts(limit) {
      return summaries.slice(0, Math.max(0, limit));
    },
    async getPublishedPostBySlug(slug) {
      const record = posts.find((post) => post.slug === slug);
      const summary = summaries.find((post) => post.slug === slug);
      if (!record || !summary) return null;
      return createPostDetail(record, summary, summaries);
    },
    async getArchiveGroups() {
      return archiveGroups;
    },
    async listTags() {
      return tags;
    },
    async listPublishedPostsByTag(slug) {
      if (!siteConfig.tags.some((tag) => tag.slug === slug)) return null;
      return summaries.filter((post) =>
        post.tags.some((tag) => tag.slug === slug),
      );
    },
    async listCategories() {
      return categories;
    },
    async listPublishedPostsByCategory(slug) {
      if (!siteConfig.categories.some((category) => category.slug === slug)) {
        return null;
      }
      return summaries.filter((post) => post.category.slug === slug);
    },
    async getSearchIndex() {
      return searchIndex;
    },
    async searchPublishedPosts(query) {
      return searchDocuments(searchIndex, query);
    },
    async getSiteStats() {
      return stats;
    },
    async getSidebarData() {
      return {
        site: siteConfig,
        recentPosts: summaries.slice(0, 4),
        categories,
        tags,
        archiveGroups,
        stats,
      };
    },
  };
}

export const localContentRepository = createLocalContentRepository(
  defaultSiteConfig,
  defaultPosts,
);
