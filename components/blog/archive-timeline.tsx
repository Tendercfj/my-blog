import Image from "next/image";
import Link from "next/link";

import type { ArchiveYearGroup, PostSummary } from "@/lib/content/types";
import { formatDate } from "@/lib/date";
import { routes } from "@/lib/routes";

export function ArchiveTimeline({
  groups,
  posts,
}: {
  groups?: readonly ArchiveYearGroup[];
  posts?: readonly PostSummary[];
}) {
  const resolvedGroups = groups ?? groupPosts(posts ?? []);

  return (
    <div className="glass-card p-5 sm:p-8">
      <div className="relative ml-2 border-l border-primary/25 pl-6 sm:ml-3 sm:pl-8">
        {resolvedGroups.map((group) => (
          <section key={group.year} className="pb-8 last:pb-0">
            <h2 className="relative mb-4 text-2xl font-black text-card-foreground before:absolute before:-left-[2.05rem] before:top-2 before:size-3 before:rounded-full before:bg-primary before:ring-5 before:ring-primary/12 sm:before:-left-[2.55rem]">
              {group.year}
            </h2>
            <ul className="space-y-3">
              {group.posts.map((post) => (
                <li key={post.slug} className="relative before:absolute before:-left-[1.83rem] before:top-7 before:size-2 before:rounded-full before:bg-primary/50 sm:before:-left-[2.33rem]">
                  <Link href={routes.post(post.slug)} className="group flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-muted sm:gap-4">
                    <div className="relative h-15 w-24 shrink-0 overflow-hidden rounded-lg bg-muted sm:h-18 sm:w-28">
                      <Image src={post.cover.src} alt="" fill sizes="112px" className="object-cover" />
                    </div>
                    <div className="min-w-0">
                      <time className="text-xs text-muted-foreground" dateTime={post.publishedAt}>{formatDate(post.publishedAt)}</time>
                      <h3 className="mt-0.5 line-clamp-2 font-semibold text-card-foreground group-hover:text-primary">{post.title}</h3>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

function groupPosts(posts: readonly PostSummary[]): readonly ArchiveYearGroup[] {
  const groups = new Map<number, PostSummary[]>();
  for (const post of posts) {
    const year = Number(post.publishedAt.slice(0, 4));
    groups.set(year, [...(groups.get(year) ?? []), post]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => b - a)
    .map(([year, yearPosts]) => ({ year, posts: yearPosts }));
}
