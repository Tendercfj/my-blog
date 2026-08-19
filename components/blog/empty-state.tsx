import { Inbox } from "lucide-react";
import Link from "next/link";

export function EmptyState({ message, href, label }: { message: string; href: string; label: string }) {
  return (
    <div className="glass-card px-5 py-14 text-center">
      <Inbox className="mx-auto size-9 text-primary" aria-hidden="true" />
      <p className="mt-4 text-muted-foreground">{message}</p>
      <Link href={href} className="mt-5 inline-flex rounded-lg bg-primary px-4 py-2 font-semibold text-primary-foreground hover:opacity-90">
        {label}
      </Link>
    </div>
  );
}
