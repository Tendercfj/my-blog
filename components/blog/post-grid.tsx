import { PostCard } from "@/components/blog/post-card";
import { EmptyState } from "@/components/blog/empty-state";
import type { PostSummary } from "@/lib/content/types";
import { routes } from "@/lib/routes";

export function PostGrid({ posts }: { posts: readonly PostSummary[] }) {
  if (!posts.length) {
    return <EmptyState message="还没有已发布文章，站长可以从账号工作区开始创作。" href={routes.account} label="进入账号工作区" />;
  }
  return (
    <div className="post-grid">
      {posts.map((post) => <PostCard key={post.slug} post={post} />)}
    </div>
  );
}
