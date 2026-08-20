import "server-only";

import { cache } from "react";

import { ApiProblem } from "@/lib/api/problem";
import type { ContentRepository, CursorPageInput } from "@/lib/content/contracts";
import { decodeContentCursor, encodeContentCursor } from "@/lib/content/cursor";
import { createArchiveGroups } from "@/lib/content/derive";
import { normalizeSearchText } from "@/lib/content/search";
import { getContentRepository } from "@/lib/content/source";
import type {
  ArchiveYearGroup,
  PostSummary,
  SearchDocument,
  TaxonomySummary,
} from "@/lib/content/types";

export interface ContentPage<T> {
  readonly items: readonly T[];
  readonly nextCursor: string | null;
}

export interface PostsPageInput extends CursorPageInput {
  readonly featured?: boolean;
}

function paginate<T>(
  items: readonly T[],
  input: CursorPageInput,
  context: string,
  getAnchor: (item: T) => string,
): ContentPage<T> {
  if (!Number.isInteger(input.limit) || input.limit < 1 || input.limit > 100) {
    throw new ApiProblem(422, "VALIDATION_FAILED", "分页数量无效");
  }

  let start = 0;
  if (input.cursor !== undefined) {
    const anchor = decodeContentCursor(input.cursor, context);
    const anchorIndex = items.findIndex((item) => getAnchor(item) === anchor);
    if (anchorIndex < 0) {
      throw new ApiProblem(400, "INVALID_CURSOR", "分页游标无效或已过期");
    }
    start = anchorIndex + 1;
  }

  const pageItems = items.slice(start, start + input.limit);
  const hasNextPage = start + pageItems.length < items.length;
  const lastItem = pageItems.at(-1);
  return {
    items: pageItems,
    nextCursor:
      hasNextPage && lastItem
        ? encodeContentCursor(context, getAnchor(lastItem))
        : null,
  };
}

function postAnchor(post: PostSummary): string {
  return `${post.publishedAt}:${post.slug}`;
}

function taxonomyAnchor(taxonomy: TaxonomySummary): string {
  return taxonomy.slug;
}

function searchAnchor(document: SearchDocument): string {
  return `${document.publishedAt}:${document.slug}`;
}

export function createContentReadService(repository: ContentRepository) {
  return {
    getSiteConfig: () => repository.getSiteConfig(),
    getPublishedPosts: () => repository.listPublishedPosts(),
    async listPublishedPostsPage(input: PostsPageInput) {
      const posts = await repository.listPublishedPosts();
      const filtered =
        input.featured === undefined
          ? posts
          : posts.filter((post) => post.featured === input.featured);
      return paginate(
        filtered,
        input,
        `posts:featured=${input.featured ?? "all"}`,
        postAnchor,
      );
    },
    getRecentPosts: (limit: number) => repository.getRecentPosts(limit),
    getPublishedPostBySlug: (slug: string) =>
      repository.getPublishedPostBySlug(slug),
    getArchiveGroups: () => repository.getArchiveGroups(),
    async listArchiveGroupsPage(input: CursorPageInput) {
      const posts = (await repository.getArchiveGroups()).flatMap(
        (group) => group.posts,
      );
      const page = paginate(posts, input, "archives", postAnchor);
      return {
        items: createArchiveGroups(page.items) as readonly ArchiveYearGroup[],
        nextCursor: page.nextCursor,
      };
    },
    getTags: () => repository.listTags(),
    async listTagsPage(input: CursorPageInput) {
      return paginate(await repository.listTags(), input, "tags", taxonomyAnchor);
    },
    getPublishedPostsByTag: (slug: string) =>
      repository.listPublishedPostsByTag(slug),
    async listPublishedPostsByTagPage(slug: string, input: CursorPageInput) {
      const posts = await repository.listPublishedPostsByTag(slug);
      return posts === null
        ? null
        : paginate(posts, input, `tag:${slug}`, postAnchor);
    },
    getCategories: () => repository.listCategories(),
    async listCategoriesPage(input: CursorPageInput) {
      return paginate(
        await repository.listCategories(),
        input,
        "categories",
        taxonomyAnchor,
      );
    },
    getPublishedPostsByCategory: (slug: string) =>
      repository.listPublishedPostsByCategory(slug),
    async listPublishedPostsByCategoryPage(
      slug: string,
      input: CursorPageInput,
    ) {
      const posts = await repository.listPublishedPostsByCategory(slug);
      return posts === null
        ? null
        : paginate(posts, input, `category:${slug}`, postAnchor);
    },
    getSearchIndex: () => repository.getSearchIndex(),
    async searchPublishedPostsPage(
      rawQuery: string,
      input: CursorPageInput,
    ) {
      const query = normalizeSearchText(rawQuery);
      if (!query) {
        throw new ApiProblem(422, "VALIDATION_FAILED", "请输入搜索关键词");
      }
      const documents = await repository.searchPublishedPosts(query);
      return paginate(
        documents,
        input,
        `search:${query}`,
        searchAnchor,
      );
    },
    getSiteStats: () => repository.getSiteStats(),
    async getSidebarData(recentLimit = 4) {
      if (
        !Number.isInteger(recentLimit) ||
        recentLimit < 0 ||
        recentLimit > 20
      ) {
        throw new ApiProblem(422, "VALIDATION_FAILED", "最新文章数量无效");
      }
      const sidebar = await repository.getSidebarData();
      if (recentLimit === 4) return sidebar;
      return {
        ...sidebar,
        recentPosts: await repository.getRecentPosts(recentLimit),
      };
    },
  };
}

const contentReadService = createContentReadService(getContentRepository());

export const getSiteConfig = cache(() => contentReadService.getSiteConfig());
export const getPublishedPosts = cache(() =>
  contentReadService.getPublishedPosts(),
);
export const listPublishedPostsPage = (input: PostsPageInput) =>
  contentReadService.listPublishedPostsPage(input);
export const getRecentPosts = cache((limit: number) =>
  contentReadService.getRecentPosts(limit),
);
export const getPublishedPostBySlug = cache((slug: string) =>
  contentReadService.getPublishedPostBySlug(slug),
);
export const getArchiveGroups = cache(() =>
  contentReadService.getArchiveGroups(),
);
export const listArchiveGroupsPage = (input: CursorPageInput) =>
  contentReadService.listArchiveGroupsPage(input);
export const getTags = cache(() => contentReadService.getTags());
export const listTagsPage = (input: CursorPageInput) =>
  contentReadService.listTagsPage(input);
export const getPublishedPostsByTag = cache((slug: string) =>
  contentReadService.getPublishedPostsByTag(slug),
);
export const listPublishedPostsByTagPage = (
  slug: string,
  input: CursorPageInput,
) => contentReadService.listPublishedPostsByTagPage(slug, input);
export const getCategories = cache(() => contentReadService.getCategories());
export const listCategoriesPage = (input: CursorPageInput) =>
  contentReadService.listCategoriesPage(input);
export const getPublishedPostsByCategory = cache((slug: string) =>
  contentReadService.getPublishedPostsByCategory(slug),
);
export const listPublishedPostsByCategoryPage = (
  slug: string,
  input: CursorPageInput,
) => contentReadService.listPublishedPostsByCategoryPage(slug, input);
export const getSearchIndex = cache(() =>
  contentReadService.getSearchIndex(),
);
export const searchPublishedPostsPage = (
  query: string,
  input: CursorPageInput,
) => contentReadService.searchPublishedPostsPage(query, input);
export const getSiteStats = cache(() => contentReadService.getSiteStats());
export const getSidebarData = cache((recentLimit = 4) =>
  contentReadService.getSidebarData(recentLimit),
);
