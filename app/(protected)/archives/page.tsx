import type { Metadata } from "next";
import { CalendarRange } from "lucide-react";

import { ArchiveTimeline } from "@/components/blog/archive-timeline";
import { PageIntro } from "@/components/blog/page-intro";
import { StandardTwoColumnLayout } from "@/components/site/page-layout";
import { BlogSidebar } from "@/components/sidebar/blog-sidebar";
import { requireCurrentSession } from "@/lib/auth/session";
import { getArchiveGroups, getSidebarData } from "@/lib/content/repository";

export const metadata: Metadata = {
  title: "文章归档",
  description: "按年份浏览棱镜手记的全部示例文章。",
};

export default async function ArchivesPage() {
  await requireCurrentSession();
  const [groups, sidebar] = await Promise.all([getArchiveGroups(), getSidebarData()]);
  const count = groups.reduce((total, group) => total + group.posts.length, 0);

  return (
    <StandardTwoColumnLayout sidebar={<BlogSidebar data={sidebar} />}>
      <PageIntro
        eyebrow="Archive"
        title={`文章归档 · ${count}`}
        description="沿着时间线，回看每一篇被认真记录下来的示例文章。"
        icon={<CalendarRange className="size-4" aria-hidden="true" />}
      />
      <ArchiveTimeline groups={groups} />
    </StandardTwoColumnLayout>
  );
}
