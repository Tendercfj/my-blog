import { PostCard } from "@/components/blog/post-card";
import type { PostSummary } from "@/lib/content/types";

export function PostGrid({ posts }: { posts: readonly PostSummary[] }) {
  return (
    <div className="post-grid">
      {posts.map((post) => <PostCard key={post.slug} post={post} />)}
    </div>
  );
}
