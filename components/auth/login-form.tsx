"use client";

import { LockKeyhole, LogIn, Mail } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { routes } from "@/lib/routes";

function errorMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== "object" || !("error" in payload)) return null;
  const error = payload.error;
  if (!error || typeof error !== "object" || !("message" in error)) return null;
  return typeof error.message === "string" ? error.message : null;
}

export function LoginForm() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");

    try {
      const response = await fetch("/api/v1/auth/login", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const payload: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        setError(errorMessage(payload) ?? "登录失败，请稍后重试");
        return;
      }

      router.replace(routes.account);
      router.refresh();
    } catch {
      setError("无法连接登录服务，请检查网络后重试");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="mt-7 grid gap-5" onSubmit={submit} noValidate>
      <div className="grid gap-2">
        <label htmlFor="owner-email" className="text-sm font-semibold text-card-foreground">
          登录邮箱
        </label>
        <div className="flex items-center gap-3 rounded-xl border border-input bg-background/75 px-4 transition focus-within:border-primary focus-within:ring-3 focus-within:ring-primary/15">
          <Mail className="size-4 text-muted-foreground" aria-hidden="true" />
          <input
            id="owner-email"
            name="email"
            type="email"
            autoComplete="username"
            inputMode="email"
            required
            maxLength={320}
            disabled={submitting}
            className="min-w-0 flex-1 bg-transparent py-3 text-card-foreground outline-none placeholder:text-muted-foreground"
            placeholder="owner@example.com"
          />
        </div>
      </div>

      <div className="grid gap-2">
        <label htmlFor="owner-password" className="text-sm font-semibold text-card-foreground">
          密码
        </label>
        <div className="flex items-center gap-3 rounded-xl border border-input bg-background/75 px-4 transition focus-within:border-primary focus-within:ring-3 focus-within:ring-primary/15">
          <LockKeyhole className="size-4 text-muted-foreground" aria-hidden="true" />
          <input
            id="owner-password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            maxLength={1024}
            disabled={submitting}
            className="min-w-0 flex-1 bg-transparent py-3 text-card-foreground outline-none placeholder:text-muted-foreground"
            placeholder="输入站长密码"
          />
        </div>
      </div>

      <div aria-live="polite" aria-atomic="true" className="min-h-6">
        {error ? (
          <p className="rounded-lg border border-destructive/30 bg-destructive/8 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}
      </div>

      <Button type="submit" size="lg" disabled={submitting} className="w-full">
        <LogIn className="size-4" aria-hidden="true" />
        {submitting ? "正在登录…" : "登录站长账号"}
      </Button>
    </form>
  );
}
