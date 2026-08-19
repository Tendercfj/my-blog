"use client";

import { ArrowUp } from "lucide-react";
import { useEffect, useRef } from "react";

import { ThemeToggle } from "@/components/theme/theme-toggle";

export function FloatingTools() {
  const topButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const update = () => {
      topButtonRef.current?.toggleAttribute("data-visible", window.scrollY > 360);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  const scrollToTop = () => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduceMotion ? "instant" : "smooth" });
  };

  return (
    <div className="floating-tools" aria-label="页面快捷操作">
      <ThemeToggle />
      <button
        ref={topButtonRef}
        type="button"
        className="floating-button back-to-top"
        aria-label="回到页面顶部"
        onClick={scrollToTop}
      >
        <ArrowUp className="size-4.5" aria-hidden="true" />
      </button>
    </div>
  );
}
