import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="site-shell">
      <main id="main-content">{children}</main>
    </div>
  );
}
