"use client";

import { LockKeyhole, LogIn, Mail, UserPlus } from "lucide-react";
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

type AuthMode = "login" | "register";

export function AuthForm() {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("login");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function selectMode(nextMode: AuthMode) {
    if (submitting) return;
    setMode(nextMode);
    setError(null);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");
    const passwordConfirmation = String(formData.get("passwordConfirmation") ?? "");

    try {
      const response = await fetch(`/api/v1/auth/${mode}`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          mode === "register" ? { email, password, passwordConfirmation } : { email, password },
        ),
      });
      const payload: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        setError(
          errorMessage(payload) ??
            (mode === "register" ? "注册失败，请稍后重试" : "登录失败，请稍后重试"),
        );
        return;
      }

      router.replace(routes.account);
      router.refresh();
    } catch {
      setError("无法连接认证服务，请检查网络后重试");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="mt-7 grid gap-5" onSubmit={submit} noValidate>
      <div className="grid grid-cols-2 gap-1 rounded-xl border border-border bg-muted/70 p-1">
        <button
          type="button"
          aria-pressed={mode === "login"}
          disabled={submitting}
          onClick={() => selectMode("login")}
          className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
            mode === "login"
              ? "bg-card text-card-foreground shadow-sm"
              : "text-muted-foreground hover:text-card-foreground"
          }`}
        >
          登录
        </button>
        <button
          type="button"
          aria-pressed={mode === "register"}
          disabled={submitting}
          onClick={() => selectMode("register")}
          className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
            mode === "register"
              ? "bg-card text-card-foreground shadow-sm"
              : "text-muted-foreground hover:text-card-foreground"
          }`}
        >
          首次注册
        </button>
      </div>

      {mode === "register" ? (
        <p className="rounded-xl border border-primary/20 bg-primary/6 px-4 py-3 text-sm leading-6 text-muted-foreground">
          仅数据库中尚无账号时可以注册。首个成功注册的账号将成为唯一站长账号。
        </p>
      ) : null}

      <div className="grid gap-2">
        <label htmlFor="owner-email" className="text-sm font-semibold text-card-foreground">
          邮箱
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
            autoComplete={mode === "register" ? "new-password" : "current-password"}
            required
            maxLength={1024}
            disabled={submitting}
            className="min-w-0 flex-1 bg-transparent py-3 text-card-foreground outline-none placeholder:text-muted-foreground"
            minLength={mode === "register" ? 12 : undefined}
            placeholder={mode === "register" ? "至少 12 位密码" : "输入站长密码"}
          />
        </div>
      </div>

      {mode === "register" ? (
        <div className="grid gap-2">
          <label
            htmlFor="owner-password-confirmation"
            className="text-sm font-semibold text-card-foreground"
          >
            确认密码
          </label>
          <div className="flex items-center gap-3 rounded-xl border border-input bg-background/75 px-4 transition focus-within:border-primary focus-within:ring-3 focus-within:ring-primary/15">
            <LockKeyhole className="size-4 text-muted-foreground" aria-hidden="true" />
            <input
              id="owner-password-confirmation"
              name="passwordConfirmation"
              type="password"
              autoComplete="new-password"
              required
              minLength={12}
              maxLength={1024}
              disabled={submitting}
              className="min-w-0 flex-1 bg-transparent py-3 text-card-foreground outline-none placeholder:text-muted-foreground"
              placeholder="再次输入密码"
            />
          </div>
        </div>
      ) : null}

      <div aria-live="polite" aria-atomic="true" className="min-h-6">
        {error ? (
          <p className="rounded-lg border border-destructive/30 bg-destructive/8 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}
      </div>

      <Button type="submit" size="lg" disabled={submitting} className="w-full">
        {mode === "register" ? (
          <UserPlus className="size-4" aria-hidden="true" />
        ) : (
          <LogIn className="size-4" aria-hidden="true" />
        )}
        {submitting
          ? mode === "register"
            ? "正在注册…"
            : "正在登录…"
          : mode === "register"
            ? "注册并登录"
            : "登录站长账号"}
      </Button>
    </form>
  );
}
