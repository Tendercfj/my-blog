import { ListTree } from "lucide-react";

import type { TocItem } from "@/lib/content/types";

export function TableOfContents({ items }: { items: readonly TocItem[] }) {
  return (
    <nav aria-label="文章目录" className="glass-card p-5">
      <h2 className="flex items-center gap-2 font-bold text-card-foreground"><ListTree className="size-4 text-primary" aria-hidden="true" />目录</h2>
      <ol className="mt-3 space-y-1">
        {items.map((item) => (
          <li key={item.id} className={item.level === 3 ? "pl-4" : undefined}>
            <a href={`#${item.id}`} className="block rounded-lg px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-primary">
              {item.text}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
