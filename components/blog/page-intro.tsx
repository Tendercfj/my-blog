import type { ReactNode } from "react";

export function PageIntro({
  eyebrow,
  title,
  description,
  icon,
}: {
  eyebrow: string;
  title: string;
  description: string;
  icon?: ReactNode;
}) {
  return (
    <header className="glass-card mb-5 p-6 sm:p-8">
      <p className="flex items-center gap-2 text-xs font-bold tracking-[0.18em] text-primary uppercase">
        {icon}{eyebrow}
      </p>
      <h1 className="mt-2 text-3xl font-black tracking-tight text-card-foreground sm:text-4xl">{title}</h1>
      <p className="mt-3 max-w-2xl text-sm text-muted-foreground sm:text-base">{description}</p>
    </header>
  );
}
