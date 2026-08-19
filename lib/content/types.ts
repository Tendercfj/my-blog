export type Slug = string;
export type IsoDate = `${number}-${number}-${number}`;

export interface LocalImage {
  src: `/images/${string}`;
  alt: string;
  width: number;
  height: number;
}

export interface TaxonomyDefinition {
  slug: Slug;
  name: string;
}

export interface NavigationItem {
  href: string;
  label: string;
}

export interface AuthorProfile {
  name: string;
  role: string;
  bio: string;
  avatar: LocalImage;
  links: readonly {
    label: string;
    href: string;
  }[];
}

export interface AboutContent {
  greeting: string;
  title: string;
  summary: string;
  skills: readonly string[];
  facts: readonly {
    value: string;
    label: string;
  }[];
  sections: readonly {
    title: string;
    body: string;
  }[];
}

export interface SiteConfig {
  name: string;
  description: string;
  siteUrl: string;
  logo: LocalImage;
  author: AuthorProfile;
  announcement: string;
  navigation: readonly NavigationItem[];
  categories: readonly TaxonomyDefinition[];
  tags: readonly TaxonomyDefinition[];
  about: AboutContent;
}

export type InlineContent =
  | { type: "text"; value: string }
  | { type: "link"; value: string; href: string; external?: boolean }
  | { type: "code"; value: string };

export type ContentBlock =
  | { type: "heading"; level: 2 | 3; id: string; text: string }
  | { type: "paragraph"; children: readonly InlineContent[] }
  | { type: "list"; ordered: boolean; items: readonly string[] }
  | { type: "quote"; text: string; cite?: string }
  | { type: "image"; image: LocalImage; caption?: string }
  | { type: "code"; language: string; code: string };

export interface PostRecord {
  slug: Slug;
  title: string;
  excerpt: string;
  publishedAt: IsoDate;
  updatedAt?: IsoDate;
  category: Slug;
  tags: readonly Slug[];
  cover: LocalImage;
  featured?: boolean;
  body: readonly ContentBlock[];
}

export interface TaxonomySummary extends TaxonomyDefinition {
  count: number;
}

export interface PostLink {
  slug: Slug;
  title: string;
}

export interface TocItem {
  id: string;
  text: string;
  level: 2 | 3;
}

export interface PostSummary {
  slug: Slug;
  title: string;
  excerpt: string;
  publishedAt: IsoDate;
  updatedAt?: IsoDate;
  category: TaxonomySummary;
  tags: readonly TaxonomySummary[];
  cover: LocalImage;
  featured: boolean;
  readingMinutes: number;
  wordCount: number;
}

export interface PostDetail extends PostSummary {
  body: readonly ContentBlock[];
  toc: readonly TocItem[];
  previous: PostLink | null;
  next: PostLink | null;
}

export interface ArchiveYearGroup {
  year: number;
  posts: readonly PostSummary[];
}

export interface SearchDocument {
  slug: Slug;
  title: string;
  excerpt: string;
  category: string;
  tags: readonly string[];
  publishedAt: IsoDate;
}

export interface SiteStats {
  posts: number;
  categories: number;
  tags: number;
  years: number;
}

export interface SidebarData {
  site: SiteConfig;
  recentPosts: readonly PostSummary[];
  categories: readonly TaxonomySummary[];
  tags: readonly TaxonomySummary[];
  archiveGroups: readonly ArchiveYearGroup[];
  stats: SiteStats;
}
