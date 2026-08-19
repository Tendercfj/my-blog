import { ExternalLink, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";

import { FullWidthLayout } from "@/components/site/page-layout";
import { getSiteConfig } from "@/lib/content/repository";

export const metadata: Metadata = {
  title: "关于",
  description: "关于棱镜手记与这套博客布局。",
};

export default async function AboutPage() {
  const site = await getSiteConfig();
  const about = site.about;

  return (
    <FullWidthLayout>
      <article className="glass-card overflow-hidden">
        <header className="relative overflow-hidden px-5 py-12 text-center sm:px-10 sm:py-16">
          <div className="absolute inset-x-0 top-0 h-48 bg-[radial-gradient(circle_at_50%_0%,rgba(66,90,239,.2),transparent_70%)]" aria-hidden="true" />
          <div className="relative">
            <Image
              src={site.author.avatar.src}
              alt={site.author.avatar.alt}
              width={128}
              height={128}
              className="mx-auto rounded-full border-5 border-background shadow-xl"
              priority
            />
            <p className="mt-5 flex items-center justify-center gap-2 text-sm font-semibold text-primary">
              <Sparkles className="size-4" aria-hidden="true" />{about.greeting}
            </p>
            <h1 className="mx-auto mt-2 max-w-3xl text-3xl leading-tight font-black tracking-tight text-card-foreground sm:text-5xl">
              {about.title}
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-muted-foreground">{about.summary}</p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {about.skills.map((skill) => (
                <span key={skill} className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">{skill}</span>
              ))}
            </div>
            <div className="mt-6 flex justify-center gap-3">
              {site.author.links.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium hover:border-primary/40 hover:text-primary"
                >
                  {link.label}<ExternalLink className="size-3.5" aria-hidden="true" />
                </a>
              ))}
            </div>
          </div>
        </header>
        <section aria-label="站点事实" className="grid grid-cols-3 border-y border-border bg-muted/50">
          {about.facts.map((fact) => (
            <div key={fact.label} className="px-2 py-6 text-center sm:py-8">
              <strong className="block text-2xl font-black text-primary sm:text-3xl">{fact.value}</strong>
              <span className="text-xs text-muted-foreground sm:text-sm">{fact.label}</span>
            </div>
          ))}
        </section>
        <div className="mx-auto max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
          {about.sections.map((section) => (
            <section key={section.title} className="mb-9 last:mb-0">
              <h2 className="text-2xl font-black tracking-tight text-card-foreground">{section.title}</h2>
              <p className="mt-3 text-base leading-8 text-muted-foreground">{section.body}</p>
            </section>
          ))}
        </div>
      </article>
    </FullWidthLayout>
  );
}
