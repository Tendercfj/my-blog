"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { NavigationItem } from "@/lib/content/types";

export function NavLinks({ items }: { items: readonly NavigationItem[] }) {
  const pathname = usePathname();

  return (
    <nav aria-label="主导航" className="flex items-center gap-1">
      {items.map((item) => {
        const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              active
                ? "bg-primary/12 text-primary"
                : "text-foreground/75 hover:bg-muted hover:text-card-foreground"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
