import type {
  ArchiveYearGroup,
  ContentBlock,
  OwnerPost,
  PostDetail,
  PostSummary,
  SidebarData,
} from "@/lib/content/types";

export function toOwnerPostDto(post: OwnerPost) {
  return {
    ...post,
    excerpt: post.excerpt,
    deletedAt: post.deletedAt,
    publishedAt: post.publishedAt,
    updatedAt: post.updatedAt,
    body: post.body.map(toContentBlockDto),
  };
}

function toContentBlockDto(block: ContentBlock) {
  switch (block.type) {
    case "quote":
      return { ...block, cite: block.cite ?? null };
    case "image":
      return { ...block, caption: block.caption ?? null };
    default:
      return block;
  }
}

export function toPostSummaryDto(post: PostSummary) {
  return { ...post, updatedAt: post.updatedAt ?? null };
}

export function toPostDetailDto(post: PostDetail) {
  return {
    ...toPostSummaryDto(post),
    body: post.body.map(toContentBlockDto),
    toc: post.toc,
    previous: post.previous,
    next: post.next,
  };
}

export function toArchiveGroupsDto(groups: readonly ArchiveYearGroup[]) {
  return groups.map((group) => ({
    ...group,
    posts: group.posts.map(toPostSummaryDto),
  }));
}

export function toSidebarDto(sidebar: SidebarData) {
  return {
    ...sidebar,
    recentPosts: sidebar.recentPosts.map(toPostSummaryDto),
    archiveGroups: toArchiveGroupsDto(sidebar.archiveGroups),
  };
}
