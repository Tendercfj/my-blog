import type { Metadata } from "next";
import { FolderTree } from "lucide-react";

import { CategoryList } from "@/components/blog/category-list";
import { FullWidthLayout } from "@/components/site/page-layout";
import { requireCurrentSession } from "@/lib/auth/session";
import { getAllCategories } from "@/lib/content/repository";

export const metadata: Metadata = {
  title: "分类",
  description: "通过分类浏览棱镜手记的示例文章。",
};

export default async function CategoriesPage() {
  await requireCurrentSession();
  const categories = await getAllCategories();
  return (
    <FullWidthLayout>
      <section className="glass-card px-5 py-8 sm:px-10 sm:py-12">
        <div className="text-center">
          <p className="flex items-center justify-center gap-2 text-xs font-bold tracking-[0.18em] text-primary uppercase">
            <FolderTree className="size-4" aria-hidden="true" />Categories
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-card-foreground sm:text-4xl">文章分类</h1>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">从清晰的主题入口开始浏览，每个数量均由文章数据自动派生。</p>
        </div>
        <div className="mx-auto mt-8 max-w-3xl"><CategoryList categories={categories} /></div>
      </section>
    </FullWidthLayout>
  );
}
