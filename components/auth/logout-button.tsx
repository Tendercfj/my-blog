"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { routes } from "@/lib/routes";

export function LogoutButton() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  async function logout() {
    setSubmitting(true);
    try {
      await fetch("/api/v1/auth/logout", {
        method: "POST",
        credentials: "same-origin",
      });
    } finally {
      router.replace(routes.home);
      router.refresh();
    }
  }

  return (
    <Button type="button" variant="outline" size="lg" onClick={logout} disabled={submitting}>
      <LogOut className="size-4" aria-hidden="true" />
      {submitting ? "正在退出…" : "退出登录"}
    </Button>
  );
}
