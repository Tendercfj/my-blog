"use client";

import { Dialog } from "@base-ui/react/dialog";
import { Search, X } from "lucide-react";
import Link from "next/link";
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import { getJson } from "@/lib/api/client";
import { searchSuccessEnvelopeSchema } from "@/lib/content/api-contract";
import type { SearchDocument } from "@/lib/content/types";
import { formatDate } from "@/lib/date";
import { routes } from "@/lib/routes";

interface SearchContextValue {
  openSearch: (trigger: HTMLElement) => void;
}

const SearchContext = createContext<SearchContextValue | null>(null);

export function SearchProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<readonly SearchDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const normalizedQuery = query.normalize("NFKC").trim();
    if (!normalizedQuery) return;

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await getJson(
          `/api/v1/search?q=${encodeURIComponent(normalizedQuery)}&limit=8`,
          searchSuccessEnvelopeSchema,
          { signal: controller.signal },
        );
        if (!controller.signal.aborted) setResults(response.data);
      } catch (requestError) {
        if (!controller.signal.aborted) {
          setResults([]);
          setError(
            requestError instanceof Error
              ? requestError.message
              : "搜索失败，请稍后重试。",
          );
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 180);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [query]);

  const resetSearch = () => {
    setQuery("");
    setResults([]);
    setLoading(false);
    setError(null);
  };

  const close = () => {
    setOpen(false);
    resetSearch();
  };

  return (
    <SearchContext.Provider
      value={{
        openSearch: (trigger) => {
          triggerRef.current = trigger;
          setOpen(true);
        },
      }}
    >
      {children}
      <Dialog.Root
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (!nextOpen) resetSearch();
        }}
      >
        <Dialog.Portal>
          <Dialog.Backdrop className="dialog-backdrop" />
          <Dialog.Popup
            className="search-popup glass-card"
            initialFocus={inputRef}
            finalFocus={() => triggerRef.current}
          >
            <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
              <div>
                <Dialog.Title className="text-lg font-bold text-card-foreground">
                  搜索文章
                </Dialog.Title>
                <Dialog.Description className="mt-0.5 text-sm text-muted-foreground">
                  按标题、摘要、标签或分类即时筛选
                </Dialog.Description>
              </div>
              <Dialog.Close
                className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-card-foreground"
                aria-label="关闭搜索"
              >
                <X className="size-5" aria-hidden="true" />
              </Dialog.Close>
            </div>
            <div className="p-5">
              <label className="flex items-center gap-3 rounded-xl border border-input bg-background/70 px-4 focus-within:border-primary focus-within:ring-3 focus-within:ring-primary/15">
                <Search className="size-5 text-muted-foreground" aria-hidden="true" />
                <span className="sr-only">搜索关键词</span>
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(event) => {
                    const value = event.target.value;
                    setQuery(value);
                    setResults([]);
                    setError(null);
                    setLoading(Boolean(value.normalize("NFKC").trim()));
                  }}
                  className="min-w-0 flex-1 bg-transparent py-3 text-base outline-none placeholder:text-muted-foreground"
                  placeholder="输入关键词…"
                />
              </label>
              <div className="mt-4 max-h-[50vh] overflow-y-auto pr-1">
                {!query.trim() ? (
                  <p className="rounded-xl bg-muted px-4 py-8 text-center text-sm text-muted-foreground">
                    试试搜索 “Next.js”、“设计” 或 “工作流”
                  </p>
                ) : loading ? (
                  <p className="rounded-xl bg-muted px-4 py-8 text-center text-sm text-muted-foreground" role="status">
                    正在搜索…
                  </p>
                ) : error ? (
                  <p className="rounded-xl bg-destructive/10 px-4 py-8 text-center text-sm text-destructive" role="alert">
                    {error}
                  </p>
                ) : results.length ? (
                  <ul className="space-y-2">
                    {results.map((result) => (
                      <li key={result.slug}>
                        <Link
                          href={routes.post(result.slug)}
                          onClick={close}
                          className="block rounded-xl border border-transparent px-4 py-3 transition-colors hover:border-border hover:bg-muted focus-visible:border-primary"
                        >
                          <div className="flex items-center justify-between gap-4">
                            <h3 className="font-semibold text-card-foreground">{result.title}</h3>
                            <time className="shrink-0 text-xs text-muted-foreground">
                              {formatDate(result.publishedAt)}
                            </time>
                          </div>
                          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                            {result.excerpt}
                          </p>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="rounded-xl bg-muted px-4 py-8 text-center text-sm text-muted-foreground">
                    没有找到匹配文章，换一个关键词试试。
                  </p>
                )}
              </div>
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </SearchContext.Provider>
  );
}

export function SearchTrigger({ className = "" }: { className?: string }) {
  const context = useContext(SearchContext);
  if (!context) throw new Error("SearchTrigger must be used inside SearchProvider");

  return (
    <button
      type="button"
      className={className}
      aria-label="打开文章搜索"
      onClick={(event) => context.openSearch(event.currentTarget)}
    >
      <Search className="size-4.5" aria-hidden="true" />
      <span className="hidden lg:inline">搜索</span>
    </button>
  );
}
