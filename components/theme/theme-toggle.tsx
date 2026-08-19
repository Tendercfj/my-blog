"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect } from "react";

function applyTheme(theme: "light" | "dark") {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

export function ThemeToggle() {
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (event: MediaQueryListEvent) => {
      if (!localStorage.getItem("blog-theme")) {
        applyTheme(event.matches ? "dark" : "light");
      }
    };
    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, []);

  const toggleTheme = () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    applyTheme(next);
    localStorage.setItem("blog-theme", next);
  };

  return (
    <button
      type="button"
      className="floating-button"
      aria-label="切换浅色或深色主题"
      onClick={toggleTheme}
    >
      <Sun className="theme-icon-sun size-4.5" aria-hidden="true" />
      <Moon className="theme-icon-moon size-4.5" aria-hidden="true" />
    </button>
  );
}
