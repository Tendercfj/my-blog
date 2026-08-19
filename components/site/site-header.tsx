import Image from "next/image";
import Link from "next/link";
import { LogIn } from "lucide-react";

import { SearchTrigger } from "@/components/search/search-provider";
import { MobileNav } from "@/components/site/mobile-nav";
import { NavLinks } from "@/components/site/nav-links";
import type { SiteConfig, SiteStats } from "@/lib/content/types";
import { routes } from "@/lib/routes";

export function SiteHeader({ site, stats }: { site: SiteConfig; stats: SiteStats }) {
  return (
    <header className="fixed inset-x-0 top-0 z-50 h-(--nav-height) border-b border-border/70 bg-background/75 backdrop-blur-xl">
      <div className="page-container flex h-full items-center justify-between gap-4">
        <Link href="/" className="flex min-w-0 items-center gap-2.5 rounded-lg font-bold text-card-foreground">
          <Image src={site.logo.src} alt="" width={32} height={32} priority />
          <span className="truncate text-base tracking-tight">{site.name}</span>
        </Link>
        <div className="hidden items-center gap-2 min-[769px]:flex">
          <SearchTrigger className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-foreground/75 transition-colors hover:bg-muted hover:text-card-foreground" />
          <NavLinks items={site.navigation} />
          <Link
            href={routes.login}
            className="ml-1 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/80"
          >
            <LogIn className="size-4" aria-hidden="true" />
            登录
          </Link>
        </div>
        <div className="flex items-center gap-1 min-[769px]:hidden">
          <SearchTrigger className="rounded-lg p-2 text-foreground/80 transition-colors hover:bg-muted hover:text-card-foreground" />
          <MobileNav site={site} stats={stats} />
        </div>
      </div>
    </header>
  );
}
