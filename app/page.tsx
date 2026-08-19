import { BookOpenText } from "lucide-react";

import { PostGrid } from "@/components/blog/post-grid";
import { HomeHero } from "@/components/home/home-hero";
import { StandardTwoColumnLayout } from "@/components/site/page-layout";
import { BlogSidebar } from "@/components/sidebar/blog-sidebar";
import { getAllPosts, getSidebarData } from "@/lib/content/repository";
import { absoluteUrl, serializeJsonLd } from "@/lib/metadata";

export default async function Home() {
  const [posts, sidebar] = await Promise.all([getAllPosts(), getSidebarData()]);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Blog",
    name: sidebar.site.name,
    description: sidebar.site.description,
    url: absoluteUrl("/", sidebar.site),
    author: { "@type": "Person", name: sidebar.site.author.name },
  };

  return (
    <>
      <script type="application/ld+json">{serializeJsonLd(jsonLd)}</script>
      <HomeHero
        site={sidebar.site}
        categories={sidebar.categories.filter((category) => category.count > 0)}
      />
      <StandardTwoColumnLayout sidebar={<BlogSidebar data={sidebar} />}>
        <section aria-labelledby="latest-posts-title">
          <div className="mb-4 flex items-end justify-between gap-4 px-1">
            <div>
              <p className="flex items-center gap-2 text-xs font-bold tracking-[0.16em] text-primary uppercase">
                <BookOpenText className="size-4" aria-hidden="true" />Latest notes
              </p>
              <h2 id="latest-posts-title" className="mt-1 text-2xl font-black tracking-tight text-card-foreground sm:text-3xl">
                最近文章
              </h2>
            </div>
            <span className="text-sm text-muted-foreground">共 {posts.length} 篇</span>
          </div>
          <PostGrid posts={posts} />
        </section>
      </StandardTwoColumnLayout>
    </>
  );
}
