import Link from "next/link";

import type { TaxonomySummary } from "@/lib/content/types";
import { routes } from "@/lib/routes";

const colors = [
  "bg-blue-500/10 text-blue-700 hover:bg-blue-500/18 dark:text-blue-300",
  "bg-violet-500/10 text-violet-700 hover:bg-violet-500/18 dark:text-violet-300",
  "bg-pink-500/10 text-pink-700 hover:bg-pink-500/18 dark:text-pink-300",
  "bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/18 dark:text-emerald-300",
  "bg-orange-500/10 text-orange-700 hover:bg-orange-500/18 dark:text-orange-300",
];

export function TagCloud({ tags }: { tags: readonly TaxonomySummary[] }) {
  return (
    <div className="flex flex-wrap justify-center gap-3 py-4 sm:gap-4 sm:py-8">
      {tags.map((tag, index) => (
        <Link
          key={tag.slug}
          href={routes.tag(tag.slug)}
          className={`interactive-card inline-flex items-center gap-2 rounded-full px-4 py-2.5 font-semibold ${colors[index % colors.length]}`}
        >
          <span># {tag.name}</span>
          <span className="rounded-full bg-background/70 px-2 py-0.5 text-xs">{tag.count}</span>
        </Link>
      ))}
    </div>
  );
}
