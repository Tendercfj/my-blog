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

export interface CursorPageInput {
  readonly limit: number;
  readonly cursor?: string;
}

export interface CursorPage<T> {
  readonly items: readonly T[];
  readonly nextCursor: string | null;
}

export interface ContentRepository {
  getSiteConfig(): Promise<SiteConfig>;
  listPublishedPosts(): Promise<readonly PostSummary[]>;
  getRecentPosts(limit: number): Promise<readonly PostSummary[]>;
  getPublishedPostBySlug(slug: string): Promise<PostDetail | null>;
  getArchiveGroups(): Promise<readonly ArchiveYearGroup[]>;
  listTags(): Promise<readonly TaxonomySummary[]>;
  listPublishedPostsByTag(slug: string): Promise<readonly PostSummary[] | null>;
  listCategories(): Promise<readonly TaxonomySummary[]>;
  listPublishedPostsByCategory(
    slug: string,
  ): Promise<readonly PostSummary[] | null>;
  getSearchIndex(): Promise<readonly SearchDocument[]>;
  searchPublishedPosts(query: string): Promise<readonly SearchDocument[]>;
  getSiteStats(): Promise<SiteStats>;
  getSidebarData(): Promise<SidebarData>;
}

export interface QueryExecutor {
  queryRows(
    statement: string,
    parameters?: readonly unknown[],
  ): Promise<readonly unknown[]>;
}
