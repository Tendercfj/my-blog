import type { Metadata } from "next";
import { Hash } from "lucide-react";

import { TagCloud } from "@/components/blog/tag-cloud";
import { EmptyState } from "@/components/blog/empty-state";
import { FullWidthLayout } from "@/components/site/page-layout";
import { requireCurrentSession } from "@/lib/auth/session";
import { getSiteConfig, getTags } from "@/lib/content/service";
import { createPageMetadata } from "@/lib/metadata";
import { routes } from "@/lib/routes";

export async function generateMetadata(): Promise<Metadata> {
  await requireCurrentSession();
  const [site, tags] = await Promise.all([getSiteConfig(), getTags()]);
  const activeCount = tags.filter((tag) => tag.count > 0).length;
  return createPageMetadata(site, {
    title: "标签",
    description: `通过 ${activeCount} 个标签浏览 ${site.name} 的已发布文章。`,
    path: routes.tags,
  });
}

export default async function TagsPage() {
  await requireCurrentSession();
  const tags = await getTags();
  return (
    <FullWidthLayout>
      <section className="glass-card px-5 py-8 text-center sm:px-10 sm:py-12">
        <p className="flex items-center justify-center gap-2 text-xs font-bold tracking-[0.18em] text-primary uppercase">
          <Hash className="size-4" aria-hidden="true" />Tag cloud
        </p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-card-foreground sm:text-4xl">标签</h1>
        <p className="mx-auto mt-3 max-w-xl text-muted-foreground">用一组柔和的计数胶囊，找到彼此关联的主题。</p>
        {tags.length ? <TagCloud tags={tags} /> : <div className="mx-auto mt-8 max-w-3xl"><EmptyState message="暂无标签，发布文章时可添加标签。" href={routes.account} label="进入账号工作区" /></div>}
      </section>
    </FullWidthLayout>
  );
}
