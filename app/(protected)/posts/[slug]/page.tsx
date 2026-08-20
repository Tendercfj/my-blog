import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PostBody } from "@/components/blog/post-body";
import { PostHero } from "@/components/blog/post-hero";
import { StandardTwoColumnLayout } from "@/components/site/page-layout";
import { BlogSidebar } from "@/components/sidebar/blog-sidebar";
import { requireCurrentSession } from "@/lib/auth/session";
import {
  getPublishedPostBySlug,
  getSidebarData,
  getSiteConfig,
} from "@/lib/content/service";
import { absoluteUrl, createPageMetadata, serializeJsonLd } from "@/lib/metadata";
import { routes } from "@/lib/routes";

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  await requireCurrentSession();
  const { slug } = await params;
  const [site, post] = await Promise.all([
    getSiteConfig(),
    getPublishedPostBySlug(slug),
  ]);
  if (!post) notFound();
  return createPageMetadata(site, {
    title: post.title,
    description: post.excerpt,
    path: routes.post(post.slug),
    image: post.cover,
  });
}

export default async function PostPage({ params }: PageProps) {
  await requireCurrentSession();
  const { slug } = await params;
  const [post, sidebar] = await Promise.all([
    getPublishedPostBySlug(slug),
    getSidebarData(),
  ]);
  if (!post) notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.excerpt,
    datePublished: post.publishedAt,
    dateModified: post.updatedAt ?? post.publishedAt,
    url: absoluteUrl(routes.post(post.slug), sidebar.site),
    image: absoluteUrl(post.cover.src, sidebar.site),
    author: { "@type": "Person", name: sidebar.site.author.name },
  };

  return (
    <>
      <script type="application/ld+json">{serializeJsonLd(jsonLd)}</script>
      <StandardTwoColumnLayout sidebar={<BlogSidebar data={sidebar} toc={post.toc} />}>
        <PostHero post={post} />
        <PostBody post={post} />
      </StandardTwoColumnLayout>
    </>
  );
}
