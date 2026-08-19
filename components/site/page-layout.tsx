import type { ReactNode } from "react";

export function StandardTwoColumnLayout({
  children,
  sidebar,
}: {
  children: ReactNode;
  sidebar: ReactNode;
}) {
  return (
    <div className="page-container page-section">
      <div className="two-column-layout">
        <div className="min-w-0">{children}</div>
        {sidebar}
      </div>
    </div>
  );
}

export function FullWidthLayout({ children }: { children: ReactNode }) {
  return <div className="page-container page-section">{children}</div>;
}
