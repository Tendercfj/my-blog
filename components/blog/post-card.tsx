import { CalendarDays, Folder } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import type { PostSummary } from "@/lib/content/types";
import { formatDate } from "@/lib/date";
import { routes } from "@/lib/routes";

export function PostCard({ post }: { post: PostSummary }) {
  return (
    <article className="glass-card interactive-card group overflow-hidden">
      <Link href={routes.post(post.slug)} className="block h-full rounded-xl">
        <div className="relative aspect-[16/9] overflow-hidden bg-muted">
          <Image
            src={post.cover.src}
            alt={post.cover.alt}
            fill
            sizes="(min-width: 1025px) 38vw, (min-width: 769px) 65vw, 100vw"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.025]"
          />
        </div>
        <div className="p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="size-3.5" aria-hidden="true" />
              <time dateTime={post.publishedAt}>{formatDate(post.publishedAt)}</time>
            </span>
            <span className="inline-flex items-center gap-1.5 text-primary">
              <Folder className="size-3.5" aria-hidden="true" />
              {post.category.name}
            </span>
          </div>
          <h2 className="mt-3 line-clamp-2 text-xl leading-snug font-bold tracking-tight text-card-foreground transition-colors group-hover:text-primary">
            {post.title}
          </h2>
          <p className="mt-2 line-clamp-3 text-sm leading-7 text-muted-foreground">
            {post.excerpt}
          </p>
        </div>
      </Link>
    </article>
  );
}
