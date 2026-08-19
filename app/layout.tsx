import type { Metadata } from "next";
import type { ReactNode } from "react";

import { SiteBackground } from "@/components/site/site-background";
import { ThemeBootScript } from "@/components/theme/theme-boot-script";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "棱镜手记", template: "%s · 棱镜手记" },
  description: "记录设计、代码与日常观察的独立博客。",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body>
        <ThemeBootScript />
        <SiteBackground />
        {children}
      </body>
    </html>
  );
}
