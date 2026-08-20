import type { Metadata } from "next";
import { FolderTree } from "lucide-react";

import { CategoryList } from "@/components/blog/category-list";
import { EmptyState } from "@/components/blog/empty-state";
import { FullWidthLayout } from "@/components/site/page-layout";
import { requireCurrentSession } from "@/lib/auth/session";
import { getCategories, getSiteConfig } from "@/lib/content/service";
import { createPageMetadata } from "@/lib/metadata";
import { routes } from "@/lib/routes";

export async function generateMetadata(): Promise<Metadata> {
  await requireCurrentSession();
  const [site, categories] = await Promise.all([
    getSiteConfig(),
    getCategories(),
  ]);
  const activeCount = categories.filter((category) => category.count > 0).length;
  return createPageMetadata(site, {
    title: "分类",
    description: `通过 ${activeCount} 个分类浏览 ${site.name} 的已发布文章。`,
    path: routes.categories,
  });
}

export default async function CategoriesPage() {
  await requireCurrentSession();
  const categories = await getCategories();
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
        <div className="mx-auto mt-8 max-w-3xl">{categories.length ? <CategoryList categories={categories} /> : <EmptyState message="暂无分类，发布文章时可创建分类。" href={routes.account} label="进入账号工作区" />}</div>
      </section>
    </FullWidthLayout>
  );
}
