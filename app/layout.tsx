import type { Metadata } from "next";
import type { ReactNode } from "react";

import { FloatingTools } from "@/components/site/floating-tools";
import { SiteBackground } from "@/components/site/site-background";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { SearchProvider } from "@/components/search/search-provider";
import { ThemeBootScript } from "@/components/theme/theme-boot-script";
import {
  getSearchIndex,
  getSiteConfig,
  getSiteStats,
} from "@/lib/content/repository";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const site = await getSiteConfig();
  return {
    metadataBase: new URL(site.siteUrl),
    title: {
      default: site.name,
      template: `%s · ${site.name}`,
    },
    description: site.description,
    openGraph: {
      type: "website",
      locale: "zh_CN",
      siteName: site.name,
      title: site.name,
      description: site.description,
    },
    twitter: {
      card: "summary_large_image",
      title: site.name,
      description: site.description,
    },
  };
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const [site, searchDocuments, stats] = await Promise.all([
    getSiteConfig(),
    getSearchIndex(),
    getSiteStats(),
  ]);

  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body>
        <ThemeBootScript />
        <SearchProvider documents={searchDocuments}>
          <a className="skip-link" href="#main-content">
            跳到主要内容
          </a>
          <SiteBackground />
          <div className="site-shell">
            <SiteHeader site={site} stats={stats} />
            <main id="main-content">{children}</main>
            <SiteFooter site={site} />
          </div>
          <FloatingTools />
        </SearchProvider>
      </body>
    </html>
  );
}
