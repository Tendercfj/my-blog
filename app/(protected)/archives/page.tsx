import type { Metadata } from "next";
import { CalendarRange } from "lucide-react";

import { ArchiveTimeline } from "@/components/blog/archive-timeline";
import { PageIntro } from "@/components/blog/page-intro";
import { StandardTwoColumnLayout } from "@/components/site/page-layout";
import { BlogSidebar } from "@/components/sidebar/blog-sidebar";
import { requireCurrentSession } from "@/lib/auth/session";
import {
  getArchiveGroups,
  getSidebarData,
  getSiteConfig,
} from "@/lib/content/service";
import { createPageMetadata } from "@/lib/metadata";
import { routes } from "@/lib/routes";

export async function generateMetadata(): Promise<Metadata> {
  await requireCurrentSession();
  const [site, groups] = await Promise.all([
    getSiteConfig(),
    getArchiveGroups(),
  ]);
  const count = groups.reduce((total, group) => total + group.posts.length, 0);
  return createPageMetadata(site, {
    title: "文章归档",
    description: `按年份浏览 ${site.name} 已发布的 ${count} 篇文章。`,
    path: routes.archives,
  });
}

export default async function ArchivesPage() {
  await requireCurrentSession();
  const [groups, sidebar] = await Promise.all([getArchiveGroups(), getSidebarData()]);
  const count = groups.reduce((total, group) => total + group.posts.length, 0);

  return (
    <StandardTwoColumnLayout sidebar={<BlogSidebar data={sidebar} />}>
      <PageIntro
        eyebrow="Archive"
        title={`文章归档 · ${count}`}
        description="沿着时间线，回看每一篇被认真记录下来的已发布文章。"
        icon={<CalendarRange className="size-4" aria-hidden="true" />}
      />
      <ArchiveTimeline groups={groups} />
    </StandardTwoColumnLayout>
  );
}
