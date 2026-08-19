import { Hash } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ArchiveTimeline } from "@/components/blog/archive-timeline";
import { EmptyState } from "@/components/blog/empty-state";
import { PageIntro } from "@/components/blog/page-intro";
import { StandardTwoColumnLayout } from "@/components/site/page-layout";
import { BlogSidebar } from "@/components/sidebar/blog-sidebar";
import { requireCurrentSession } from "@/lib/auth/session";
import {
  getAllTags,
  getPostsByTag,
  getSidebarData,
  getSiteConfig,
} from "@/lib/content/repository";
import { createPageMetadata } from "@/lib/metadata";
import { routes } from "@/lib/routes";

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  await requireCurrentSession();
  const { slug } = await params;
  const [site, tags] = await Promise.all([getSiteConfig(), getAllTags()]);
  const tag = tags.find((item) => item.slug === slug);
  if (!tag) notFound();
  return createPageMetadata(site, {
    title: `标签：${tag.name}`,
    description: `浏览标签“${tag.name}”下的 ${tag.count} 篇文章。`,
    path: routes.tag(tag.slug),
  });
}

export default async function TagDetailPage({ params }: PageProps) {
  await requireCurrentSession();
  const { slug } = await params;
  const [posts, tags, sidebar] = await Promise.all([
    getPostsByTag(slug),
    getAllTags(),
    getSidebarData(),
  ]);
  const tag = tags.find((item) => item.slug === slug);
  if (!posts || !tag) notFound();

  return (
    <StandardTwoColumnLayout sidebar={<BlogSidebar data={sidebar} />}>
      <PageIntro
        eyebrow="Tag"
        title={`# ${tag.name} · ${tag.count}`}
        description={`收录所有与“${tag.name}”有关的示例文章。`}
        icon={<Hash className="size-4" aria-hidden="true" />}
      />
      {posts.length ? (
        <ArchiveTimeline posts={posts} />
      ) : (
        <EmptyState message="这个标签暂时还没有文章。" href={routes.tags} label="返回标签总览" />
      )}
    </StandardTwoColumnLayout>
  );
}
