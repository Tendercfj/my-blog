import { ChevronRight } from "lucide-react";
import Link from "next/link";

import type { TaxonomySummary } from "@/lib/content/types";
import { routes } from "@/lib/routes";

const dots = ["bg-blue-500", "bg-violet-500", "bg-pink-500", "bg-emerald-500", "bg-orange-500"];

export function CategoryList({ categories }: { categories: readonly TaxonomySummary[] }) {
  return (
    <ul className="divide-y divide-border">
      {categories.map((category, index) => (
        <li key={category.slug}>
          <Link href={routes.category(category.slug)} className="group flex items-center gap-4 rounded-xl px-3 py-4 transition-colors hover:bg-muted sm:px-5">
            <span className={`size-3 shrink-0 rounded-full ${dots[index % dots.length]}`} aria-hidden="true" />
            <strong className="flex-1 text-base text-card-foreground group-hover:text-primary sm:text-lg">{category.name}</strong>
            <span className="text-sm text-muted-foreground">{category.count} 篇</span>
            <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" aria-hidden="true" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
