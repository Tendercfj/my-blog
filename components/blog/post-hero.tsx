import { BookOpen, CalendarDays, Folder, RefreshCw } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import type { PostDetail } from "@/lib/content/types";
import { formatDate } from "@/lib/date";
import { routes } from "@/lib/routes";

export function PostHero({ post }: { post: PostDetail }) {
  return (
    <header className="glass-card relative mb-5 min-h-[23rem] overflow-hidden sm:min-h-[29rem]">
      <Image src={post.cover.src} alt={post.cover.alt} fill priority sizes="(min-width: 901px) 75vw, 100vw" className="object-cover" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(12,16,30,.08),rgba(12,16,30,.82))]" />
      <div className="absolute inset-x-0 bottom-0 p-6 text-white sm:p-9">
        <Link href={routes.category(post.category.slug)} className="inline-flex items-center gap-1.5 rounded-full bg-white/14 px-3 py-1 text-xs font-semibold backdrop-blur-md hover:bg-white/22">
          <Folder className="size-3.5" aria-hidden="true" />{post.category.name}
        </Link>
        <h1 className="mt-3 max-w-4xl text-3xl leading-tight font-black tracking-tight text-balance sm:text-5xl">{post.title}</h1>
        <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs text-white/80 sm:text-sm">
          <span className="inline-flex items-center gap-1.5"><CalendarDays className="size-4" aria-hidden="true" />发布于 <time dateTime={post.publishedAt}>{formatDate(post.publishedAt)}</time></span>
          {post.updatedAt ? <span className="inline-flex items-center gap-1.5"><RefreshCw className="size-4" aria-hidden="true" />更新于 <time dateTime={post.updatedAt}>{formatDate(post.updatedAt)}</time></span> : null}
          <span className="inline-flex items-center gap-1.5"><BookOpen className="size-4" aria-hidden="true" />{post.wordCount} 字 · {post.readingMinutes} 分钟</span>
        </div>
      </div>
    </header>
  );
}
