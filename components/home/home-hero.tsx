import { ArrowUpRight, Layers3, Sparkles } from "lucide-react";
import Link from "next/link";

import type { SiteConfig, TaxonomySummary } from "@/lib/content/types";
import { routes } from "@/lib/routes";

const shortcutStyles = [
  "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  "bg-violet-500/10 text-violet-700 dark:text-violet-300",
  "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
];

export function HomeHero({
  site,
  categories,
}: {
  site: SiteConfig;
  categories: readonly TaxonomySummary[];
}) {
  return (
    <section className="page-container pb-5" aria-labelledby="home-hero-title">
      <div className="hero-layout">
        <div className="hero-left">
          <div className="glass-card relative min-h-64 overflow-hidden p-7 sm:min-h-72 sm:p-10">
            <div className="absolute -right-16 -top-20 size-72 rounded-full border-28 border-primary/10" aria-hidden="true" />
            <div className="absolute bottom-7 right-8 hidden grid-cols-4 gap-2 opacity-55 sm:grid" aria-hidden="true">
              {Array.from({ length: 12 }, (_, index) => (
                <span key={index} className="size-3 rounded-sm bg-primary/50" />
              ))}
            </div>
            <div className="relative z-1 flex h-full max-w-2xl flex-col justify-center">
              <p className="mb-4 flex items-center gap-2 text-sm font-semibold text-primary">
                <Sparkles className="size-4" aria-hidden="true" />
                设计、代码与日常观察
              </p>
              <h1 id="home-hero-title" className="text-3xl leading-tight font-black tracking-tight text-card-foreground sm:text-5xl">
                把复杂的问题，
                <span className="text-primary">整理成清楚的形状。</span>
              </h1>
              <p className="mt-5 max-w-xl text-sm text-muted-foreground sm:text-base">
                {site.description} 这里使用自有占位内容，专注呈现舒适、稳定的博客浏览体验。
              </p>
            </div>
          </div>
          <div className="category-shortcuts">
            {categories.slice(0, 3).map((category, index) => (
              <Link
                key={category.slug}
                href={routes.category(category.slug)}
                className={`interactive-card flex min-h-24 items-center justify-between rounded-xl border border-transparent p-4 ${shortcutStyles[index]}`}
              >
                <span>
                  <span className="block text-xs opacity-70">内容分类</span>
                  <strong className="mt-1 block text-base">{category.name}</strong>
                </span>
                <ArrowUpRight className="size-5" aria-hidden="true" />
              </Link>
            ))}
          </div>
        </div>
        <Link
          href={routes.about}
          className="interactive-card relative flex min-h-64 flex-col justify-between overflow-hidden rounded-xl bg-[linear-gradient(145deg,#18224d,#425aef_58%,#8f69df)] p-7 text-white shadow-xl shadow-primary/15 sm:p-8"
        >
          <div className="absolute -right-8 -top-8 size-40 rounded-full border-24 border-white/10" aria-hidden="true" />
          <Layers3 className="relative size-9" aria-hidden="true" />
          <div className="relative">
            <p className="text-sm text-white/70">ABOUT THIS BLOG</p>
            <h2 className="mt-2 text-2xl leading-tight font-bold">在文字和界面之间，留一块可以慢慢生长的地方。</h2>
            <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold">
              了解更多 <ArrowUpRight className="size-4" aria-hidden="true" />
            </span>
          </div>
        </Link>
      </div>
    </section>
  );
}
