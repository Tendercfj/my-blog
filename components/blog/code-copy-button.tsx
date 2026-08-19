"use client";

import { Check, Clipboard, TriangleAlert } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type CopyState = "idle" | "success" | "error";

export function CodeCopyButton({ code }: { code: string }) {
  const [state, setState] = useState<CopyState>("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setState("success");
    } catch {
      setState("error");
    }
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setState("idle"), 1800);
  };

  return (
    <button type="button" onClick={copy} className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-white/65 hover:bg-white/10 hover:text-white" aria-label="复制代码">
      {state === "success" ? <Check className="size-3.5" aria-hidden="true" /> : state === "error" ? <TriangleAlert className="size-3.5" aria-hidden="true" /> : <Clipboard className="size-3.5" aria-hidden="true" />}
      <span aria-live="polite">{state === "success" ? "已复制" : state === "error" ? "复制失败" : "复制"}</span>
    </button>
  );
}
