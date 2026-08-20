import { Folder } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ArchiveTimeline } from "@/components/blog/archive-timeline";
import { EmptyState } from "@/components/blog/empty-state";
import { PageIntro } from "@/components/blog/page-intro";
import { StandardTwoColumnLayout } from "@/components/site/page-layout";
import { BlogSidebar } from "@/components/sidebar/blog-sidebar";
import { requireCurrentSession } from "@/lib/auth/session";
import {
  getCategories,
  getPublishedPostsByCategory,
  getSidebarData,
  getSiteConfig,
} from "@/lib/content/service";
import { createPageMetadata } from "@/lib/metadata";
import { routes } from "@/lib/routes";

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  await requireCurrentSession();
  const { slug } = await params;
  const [site, categories] = await Promise.all([
    getSiteConfig(),
    getCategories(),
  ]);
  const category = categories.find((item) => item.slug === slug);
  if (!category) notFound();
  return createPageMetadata(site, {
    title: `分类：${category.name}`,
    description: `浏览分类“${category.name}”下的 ${category.count} 篇文章。`,
    path: routes.category(category.slug),
  });
}

export default async function CategoryDetailPage({ params }: PageProps) {
  await requireCurrentSession();
  const { slug } = await params;
  const [posts, categories, sidebar] = await Promise.all([
    getPublishedPostsByCategory(slug),
    getCategories(),
    getSidebarData(),
  ]);
  const category = categories.find((item) => item.slug === slug);
  if (!posts || !category) notFound();

  return (
    <StandardTwoColumnLayout sidebar={<BlogSidebar data={sidebar} />}>
      <PageIntro
        eyebrow="Category"
        title={`${category.name} · ${category.count}`}
        description={`收录“${category.name}”分类下的全部已发布文章。`}
        icon={<Folder className="size-4" aria-hidden="true" />}
      />
      {posts.length ? (
        <ArchiveTimeline posts={posts} />
      ) : (
        <EmptyState message="这个分类暂时还没有文章。" href={routes.categories} label="返回分类总览" />
      )}
    </StandardTwoColumnLayout>
  );
}
