import type { SiteConfig } from "@/lib/content/types";

export function SiteFooter({ site }: { site: SiteConfig }) {
  return (
    <footer className="border-t border-border/70 py-8 text-center text-sm text-muted-foreground">
      <div className="page-container">
        <p>© {new Date().getUTCFullYear()} {site.name} · 使用 Next.js 构建</p>
        <p className="mt-1">内容与视觉资产均为本项目的中性占位示例。</p>
      </div>
    </footer>
  );
}
