"use client";

import { Drawer } from "@base-ui/react/drawer";
import { CircleUserRound, Menu, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import type { SiteConfig, SiteStats } from "@/lib/content/types";
import { routes } from "@/lib/routes";

export function MobileNav({ site, stats }: { site: SiteConfig; stats: SiteStats }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 769px)");
    const handleChange = (event: MediaQueryListEvent) => {
      if (event.matches) setOpen(false);
    };
    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, []);

  return (
    <Drawer.Root open={open} onOpenChange={setOpen} swipeDirection="right">
      <Drawer.Trigger
        className="rounded-lg p-2 text-foreground/80 transition-colors hover:bg-muted hover:text-card-foreground"
        aria-label="打开移动导航"
      >
        <Menu className="size-5" aria-hidden="true" />
      </Drawer.Trigger>
      <Drawer.Portal>
        <Drawer.Backdrop className="drawer-backdrop" />
        <Drawer.Viewport className="drawer-viewport">
          <Drawer.Popup className="drawer-popup">
            <div className="flex items-start justify-between gap-4 border-b border-border p-5">
              <div>
                <Drawer.Title className="text-lg font-bold">{site.name}</Drawer.Title>
                <Drawer.Description className="mt-1 text-sm text-muted-foreground">
                  {site.description}
                </Drawer.Description>
              </div>
              <Drawer.Close
                className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-card-foreground"
                aria-label="关闭移动导航"
              >
                <X className="size-5" aria-hidden="true" />
              </Drawer.Close>
            </div>
            <div className="p-5">
              <div className="grid grid-cols-3 gap-2 rounded-xl bg-muted p-3 text-center">
                <div><strong className="block text-lg text-primary">{stats.posts}</strong><span className="text-xs text-muted-foreground">文章</span></div>
                <div><strong className="block text-lg text-primary">{stats.tags}</strong><span className="text-xs text-muted-foreground">标签</span></div>
                <div><strong className="block text-lg text-primary">{stats.categories}</strong><span className="text-xs text-muted-foreground">分类</span></div>
              </div>
              <nav aria-label="移动导航" className="mt-5 grid gap-1">
                {site.navigation.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="rounded-xl px-4 py-3 font-medium transition-colors hover:bg-muted hover:text-primary"
                  >
                    {item.label}
                  </Link>
                ))}
                <Link
                  href={routes.account}
                  onClick={() => setOpen(false)}
                  className="mt-2 flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 font-semibold text-primary-foreground transition-colors hover:bg-primary/80"
                >
                  <CircleUserRound className="size-4" aria-hidden="true" />
                  站长账号
                </Link>
              </nav>
              <p className="mt-6 rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
                {site.announcement}
              </p>
            </div>
          </Drawer.Popup>
        </Drawer.Viewport>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
