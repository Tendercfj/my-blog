import type { Metadata } from "next";
import { Hash } from "lucide-react";

import { TagCloud } from "@/components/blog/tag-cloud";
import { FullWidthLayout } from "@/components/site/page-layout";
import { getAllTags } from "@/lib/content/repository";

export const metadata: Metadata = {
  title: "标签",
  description: "通过标签浏览棱镜手记的示例文章。",
};

export default async function TagsPage() {
  const tags = await getAllTags();
  return (
    <FullWidthLayout>
      <section className="glass-card px-5 py-8 text-center sm:px-10 sm:py-12">
        <p className="flex items-center justify-center gap-2 text-xs font-bold tracking-[0.18em] text-primary uppercase">
          <Hash className="size-4" aria-hidden="true" />Tag cloud
        </p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-card-foreground sm:text-4xl">标签</h1>
        <p className="mx-auto mt-3 max-w-xl text-muted-foreground">用一组柔和的计数胶囊，找到彼此关联的主题。</p>
        <TagCloud tags={tags} />
      </section>
    </FullWidthLayout>
  );
}
