import { Bell, CalendarRange, FileText, Folder, Hash } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { TableOfContents } from "@/components/blog/table-of-contents";
import type { SidebarData, TocItem } from "@/lib/content/types";
import { formatShortDate } from "@/lib/date";
import { routes } from "@/lib/routes";

export function BlogSidebar({ data, toc }: { data: SidebarData; toc?: readonly TocItem[] }) {
  return (
    <aside aria-label="博客信息" className="min-w-0 space-y-4 min-[901px]:sticky min-[901px]:top-20 min-[901px]:self-start">
      <section className="glass-card p-5 text-center">
        <Image
          src={data.site.author.avatar.src}
          alt={data.site.author.avatar.alt}
          width={96}
          height={96}
          className="mx-auto rounded-full border-4 border-background shadow-lg"
        />
        <h2 className="mt-3 text-lg font-bold text-card-foreground">{data.site.author.name}</h2>
        <p className="text-xs font-medium text-primary">{data.site.author.role}</p>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">{data.site.author.bio}</p>
        <div className="mt-4 grid grid-cols-3 divide-x divide-border rounded-xl bg-muted py-2.5">
          <div><strong className="block text-base text-card-foreground">{data.stats.posts}</strong><span className="text-[11px] text-muted-foreground">文章</span></div>
          <div><strong className="block text-base text-card-foreground">{data.stats.tags}</strong><span className="text-[11px] text-muted-foreground">标签</span></div>
          <div><strong className="block text-base text-card-foreground">{data.stats.categories}</strong><span className="text-[11px] text-muted-foreground">分类</span></div>
        </div>
      </section>

      <section className="glass-card p-5">
        <h2 className="flex items-center gap-2 font-bold text-card-foreground"><Bell className="size-4 text-primary" aria-hidden="true" />公告</h2>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">{data.site.announcement}</p>
      </section>

      {toc?.length ? <TableOfContents items={toc} /> : null}

      <section className="glass-card p-5">
        <h2 className="flex items-center gap-2 font-bold text-card-foreground"><FileText className="size-4 text-primary" aria-hidden="true" />最新文章</h2>
        {data.recentPosts.length ? <ul className="mt-3 space-y-3">
          {data.recentPosts.map((post) => (
            <li key={post.slug}>
              <Link href={routes.post(post.slug)} className="group flex gap-3 rounded-lg">
                <div className="relative h-13 w-20 shrink-0 overflow-hidden rounded-lg bg-muted">
                  <Image src={post.cover.src} alt="" fill sizes="80px" className="object-cover" />
                </div>
                <span className="min-w-0 py-0.5">
                  <strong className="line-clamp-2 text-xs leading-5 font-semibold text-card-foreground group-hover:text-primary">{post.title}</strong>
                  <time className="mt-0.5 block text-[11px] text-muted-foreground">{formatShortDate(post.publishedAt)}</time>
                </span>
              </Link>
            </li>
          ))}
        </ul> : <p className="mt-3 text-sm text-muted-foreground">暂无文章</p>}
      </section>

      <section className="glass-card p-5">
        <h2 className="flex items-center gap-2 font-bold text-card-foreground"><Folder className="size-4 text-primary" aria-hidden="true" />分类</h2>
        {data.categories.some((category) => category.count > 0) ? <ul className="mt-3 space-y-1">
          {data.categories.map((category) => (
            <li key={category.slug}>
              <Link href={routes.category(category.slug)} className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm hover:bg-muted hover:text-primary">
                <span>{category.name}</span><span className="text-xs text-muted-foreground">{category.count}</span>
              </Link>
            </li>
          ))}
        </ul> : <p className="mt-3 text-sm text-muted-foreground">暂无分类</p>}
      </section>

      <section className="glass-card p-5">
        <h2 className="flex items-center gap-2 font-bold text-card-foreground"><Hash className="size-4 text-primary" aria-hidden="true" />标签</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {data.tags.filter((tag) => tag.count > 0).slice(0, 10).map((tag) => (
            <Link key={tag.slug} href={routes.tag(tag.slug)} className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-primary/12 hover:text-primary">
              {tag.name}
            </Link>
          ))}
          {!data.tags.some((tag) => tag.count > 0) ? <span className="text-sm text-muted-foreground">暂无标签</span> : null}
        </div>
      </section>

      <section className="glass-card p-5">
        <h2 className="flex items-center gap-2 font-bold text-card-foreground"><CalendarRange className="size-4 text-primary" aria-hidden="true" />归档</h2>
        {data.archiveGroups.length ? <ul className="mt-3 space-y-1">
          {data.archiveGroups.map((group) => (
            <li key={group.year} className="flex items-center justify-between px-2 py-1 text-sm">
              <span>{group.year}</span><span className="text-xs text-muted-foreground">{group.posts.length} 篇</span>
            </li>
          ))}
        </ul> : <p className="mt-3 text-sm text-muted-foreground">暂无归档</p>}
      </section>
    </aside>
  );
}
