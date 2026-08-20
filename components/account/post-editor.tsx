"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useReducer, useState } from "react";

import type {
  ContentBlock,
  ImageSource,
  InlineContent,
  OwnerPost,
  PostStatus,
} from "@/lib/content/types";
import { routes } from "@/lib/routes";

type Draft = {
  version: number;
  slug: string;
  title: string;
  excerpt: string | null;
  category: OwnerPost["category"];
  tags: OwnerPost["tags"];
  cover: OwnerPost["cover"];
  featured: boolean;
  body: readonly ContentBlock[];
};

type State = {
  server: Draft;
  draft: Draft;
  status: PostStatus;
  saving: boolean;
  message: string | null;
  conflict: boolean;
};

type Action =
  | { type: "set"; field: keyof Draft; value: Draft[keyof Draft] }
  | { type: "block"; index: number; block: ContentBlock }
  | { type: "add"; block: ContentBlock }
  | { type: "remove"; index: number }
  | { type: "move"; index: number; direction: -1 | 1 }
  | { type: "copy"; index: number }
  | { type: "saving" }
  | { type: "saved"; post: OwnerPost; message: string }
  | { type: "error"; message: string; conflict?: boolean };

type ApiPayload = {
  data?: OwnerPost;
  error?: { code?: string; message?: string };
};

const newPostDraft: Draft = {
  version: 1,
  slug: "",
  title: "",
  excerpt: null,
  category: null,
  tags: [],
  cover: null,
  featured: false,
  body: [
    {
      type: "paragraph",
      children: [{ type: "text", value: "开始写正文…" }],
    },
  ],
};

function initialDraft(post: OwnerPost): Draft {
  return {
    version: post.version,
    slug: post.slug ?? "",
    title: post.title,
    excerpt: post.excerpt,
    category: post.category,
    tags: post.tags,
    cover: post.cover,
    featured: post.featured,
    body: post.body,
  };
}

function nextHeadingId(body: readonly ContentBlock[], sourceId: string) {
  const headingIds = new Set(
    body.flatMap((block) => (block.type === "heading" ? [block.id] : [])),
  );
  let suffix = 1;
  let candidate = `${sourceId}-copy`;
  while (headingIds.has(candidate)) {
    suffix += 1;
    candidate = `${sourceId}-copy-${suffix}`;
  }
  return candidate;
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "set":
      return {
        ...state,
        draft: { ...state.draft, [action.field]: action.value },
        message: null,
      } as State;
    case "block":
      return {
        ...state,
        draft: {
          ...state.draft,
          body: state.draft.body.map((block, index) =>
            index === action.index ? action.block : block,
          ),
        },
        message: null,
      };
    case "add":
      return {
        ...state,
        draft: {
          ...state.draft,
          body: [...state.draft.body, action.block],
        },
        message: null,
      };
    case "remove":
      return {
        ...state,
        draft: {
          ...state.draft,
          body:
            state.draft.body.length > 1
              ? state.draft.body.filter((_, index) => index !== action.index)
              : state.draft.body,
        },
        message: null,
      };
    case "move": {
      const target = action.index + action.direction;
      if (target < 0 || target >= state.draft.body.length) return state;
      const body = [...state.draft.body];
      [body[action.index], body[target]] = [body[target], body[action.index]];
      return {
        ...state,
        draft: { ...state.draft, body },
        message: null,
      };
    }
    case "copy": {
      const body = [...state.draft.body];
      const original = body[action.index];
      const copied =
        original.type === "heading"
          ? { ...original, id: nextHeadingId(body, original.id) }
          : original;
      body.splice(action.index + 1, 0, copied);
      return {
        ...state,
        draft: { ...state.draft, body },
        message: null,
      };
    }
    case "saving":
      return { ...state, saving: true, message: null };
    case "saved": {
      const draft = initialDraft(action.post);
      return {
        ...state,
        server: draft,
        draft,
        status: action.post.status,
        saving: false,
        message: action.message,
        conflict: false,
      };
    }
    case "error":
      return {
        ...state,
        saving: false,
        message: action.message,
        conflict: action.conflict ?? false,
      };
  }
}

function updateInline(
  children: readonly InlineContent[],
  index: number,
  value: string,
): readonly InlineContent[] {
  return children.map((child, childIndex) =>
    childIndex === index ? { ...child, value } : child,
  );
}

function normalizeBodyForUpdate(
  body: readonly ContentBlock[],
): readonly ContentBlock[] {
  return body.map((block) => {
    if (block.type === "quote") {
      return block.cite ? block : { type: "quote", text: block.text };
    }
    if (block.type === "image") {
      return block.caption
        ? block
        : { type: "image", image: block.image };
    }
    return block;
  });
}

function changeInlineType(
  child: InlineContent,
  type: InlineContent["type"],
): InlineContent {
  if (type === "link") {
    return {
      type,
      value: child.value,
      href: child.type === "link" ? child.href : "/",
    };
  }
  return { type, value: child.value };
}

function Preview({ block }: { block: ContentBlock }) {
  switch (block.type) {
    case "heading":
      return block.level === 2 ? (
        <h3 className="mt-4 text-xl font-bold">{block.text}</h3>
      ) : (
        <h4 className="mt-3 text-lg font-bold">{block.text}</h4>
      );
    case "paragraph":
      return (
        <p className="mt-3 leading-7">
          {block.children.map((item) => item.value).join("")}
        </p>
      );
    case "list": {
      const List = block.ordered ? "ol" : "ul";
      return (
        <List className="mt-3 list-inside list-disc">
          {block.items.map((item, index) => (
            <li key={`${index}-${item}`}>{item}</li>
          ))}
        </List>
      );
    }
    case "quote":
      return (
        <blockquote className="mt-3 border-l-4 border-primary/40 pl-4 italic">
          {block.text}
        </blockquote>
      );
    case "image":
      return (
        <figure className="mt-3">
          <Image
            src={block.image.src}
            alt={block.image.alt}
            width={block.image.width}
            height={block.image.height}
            className="h-auto w-full rounded-lg"
          />
          {block.caption ? (
            <figcaption className="text-center text-xs text-muted-foreground">
              {block.caption}
            </figcaption>
          ) : null}
        </figure>
      );
    case "code":
      return (
        <pre className="mt-3 overflow-auto rounded-lg bg-slate-950 p-3 text-xs text-slate-100">
          <code>{block.code}</code>
        </pre>
      );
  }
}

function TextField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-1 text-xs font-semibold text-muted-foreground">
      <span>{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-md border border-border bg-background px-2 py-1.5 text-sm font-normal text-card-foreground"
      />
    </label>
  );
}

function BlockEditor({
  block,
  index,
  dispatch,
}: {
  block: ContentBlock;
  index: number;
  dispatch: React.Dispatch<Action>;
}) {
  let editor: React.ReactNode;

  switch (block.type) {
    case "heading":
      editor = (
        <div className="grid gap-2 sm:grid-cols-[90px_1fr]">
          <label className="grid gap-1 text-xs font-semibold text-muted-foreground">
            <span>层级</span>
            <select
              value={block.level}
              onChange={(event) =>
                dispatch({
                  type: "block",
                  index,
                  block: {
                    ...block,
                    level: Number(event.target.value) as 2 | 3,
                  },
                })
              }
              className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
            >
              <option value="2">H2</option>
              <option value="3">H3</option>
            </select>
          </label>
          <TextField
            label="标题"
            value={block.text}
            onChange={(text) =>
              dispatch({ type: "block", index, block: { ...block, text } })
            }
          />
          <TextField
            label="锚点 id"
            value={block.id}
            onChange={(id) =>
              dispatch({
                type: "block",
                index,
                block: {
                  ...block,
                  id:
                    id
                      .toLowerCase()
                      .replace(/[^a-z0-9]+/g, "-")
                      .replace(/^-|-$/g, "") || "section",
                },
              })
            }
          />
        </div>
      );
      break;
    case "paragraph":
      editor = (
        <div className="grid gap-2">
          {block.children.map((child, childIndex) => (
            <div
              key={childIndex}
              className="grid gap-1 sm:grid-cols-[90px_1fr_auto]"
            >
              <select
                aria-label={`第 ${childIndex + 1} 段行内内容类型`}
                value={child.type}
                onChange={(event) =>
                  dispatch({
                    type: "block",
                    index,
                    block: {
                      ...block,
                      children: block.children.map((item, itemIndex) =>
                        itemIndex === childIndex
                          ? changeInlineType(
                              item,
                              event.target.value as InlineContent["type"],
                            )
                          : item,
                      ),
                    },
                  })
                }
                className="rounded-md border border-border bg-background px-2 py-1.5 text-xs"
              >
                <option value="text">文本</option>
                <option value="link">链接</option>
                <option value="code">行内代码</option>
              </select>
              <input
                aria-label={`第 ${childIndex + 1} 段行内文本`}
                value={child.value}
                onChange={(event) =>
                  dispatch({
                    type: "block",
                    index,
                    block: {
                      ...block,
                      children: updateInline(
                        block.children,
                        childIndex,
                        event.target.value,
                      ),
                    },
                  })
                }
                className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
              />
              <button
                type="button"
                disabled={block.children.length === 1}
                onClick={() =>
                  dispatch({
                    type: "block",
                    index,
                    block: {
                      ...block,
                      children: block.children.filter(
                        (_, itemIndex) => itemIndex !== childIndex,
                      ),
                    },
                  })
                }
                className="rounded border border-border px-2 py-1 text-xs disabled:opacity-40"
              >
                删除
              </button>
              {child.type === "link" ? (
                <input
                  aria-label="链接地址"
                  value={child.href}
                  onChange={(event) =>
                    dispatch({
                      type: "block",
                      index,
                      block: {
                        ...block,
                        children: block.children.map((item, itemIndex) =>
                          itemIndex === childIndex && item.type === "link"
                            ? { ...item, href: event.target.value }
                            : item,
                        ),
                      },
                    })
                  }
                  className="rounded-md border border-border bg-background px-2 py-1.5 text-sm sm:col-start-2"
                />
              ) : null}
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              dispatch({
                type: "block",
                index,
                block: {
                  ...block,
                  children: [
                    ...block.children,
                    { type: "text", value: "新文本" },
                  ],
                },
              })
            }
            className="text-left text-xs font-semibold text-primary"
          >
            + 添加行内文本
          </button>
        </div>
      );
      break;
    case "list":
      editor = (
        <div className="grid gap-2">
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={block.ordered}
              onChange={(event) =>
                dispatch({
                  type: "block",
                  index,
                  block: { ...block, ordered: event.target.checked },
                })
              }
            />
            有序列表
          </label>
          {block.items.map((item, itemIndex) => (
            <div key={itemIndex} className="flex gap-2">
              <input
                aria-label={`列表项 ${itemIndex + 1}`}
                value={item}
                onChange={(event) =>
                  dispatch({
                    type: "block",
                    index,
                    block: {
                      ...block,
                      items: block.items.map((value, valueIndex) =>
                        valueIndex === itemIndex ? event.target.value : value,
                      ),
                    },
                  })
                }
                className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-sm"
              />
              <button
                type="button"
                disabled={block.items.length === 1}
                onClick={() =>
                  dispatch({
                    type: "block",
                    index,
                    block: {
                      ...block,
                      items: block.items.filter(
                        (_, valueIndex) => valueIndex !== itemIndex,
                      ),
                    },
                  })
                }
                className="rounded border border-border px-2 py-1 text-xs disabled:opacity-40"
              >
                删除
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              dispatch({
                type: "block",
                index,
                block: { ...block, items: [...block.items, "新条目"] },
              })
            }
            className="text-left text-xs font-semibold text-primary"
          >
            + 添加条目
          </button>
        </div>
      );
      break;
    case "quote":
      editor = (
        <div className="grid gap-2">
          <TextField
            label="引用"
            value={block.text}
            onChange={(text) =>
              dispatch({ type: "block", index, block: { ...block, text } })
            }
          />
          <TextField
            label="出处（可选）"
            value={block.cite ?? ""}
            onChange={(cite) =>
              dispatch({
                type: "block",
                index,
                block: { ...block, cite: cite || undefined },
              })
            }
          />
        </div>
      );
      break;
    case "image":
      editor = (
        <div className="grid gap-2 sm:grid-cols-2">
          <TextField
            label="图片 URL"
            value={block.image.src}
            onChange={(src) =>
              dispatch({
                type: "block",
                index,
                block: {
                  ...block,
                  image: { ...block.image, src: src as ImageSource },
                },
              })
            }
          />
          <TextField
            label="替代文本"
            value={block.image.alt}
            onChange={(alt) =>
              dispatch({
                type: "block",
                index,
                block: { ...block, image: { ...block.image, alt } },
              })
            }
          />
          <TextField
            label="宽度"
            value={String(block.image.width)}
            onChange={(value) =>
              dispatch({
                type: "block",
                index,
                block: {
                  ...block,
                  image: { ...block.image, width: Number(value) || 1 },
                },
              })
            }
          />
          <TextField
            label="高度"
            value={String(block.image.height)}
            onChange={(value) =>
              dispatch({
                type: "block",
                index,
                block: {
                  ...block,
                  image: { ...block.image, height: Number(value) || 1 },
                },
              })
            }
          />
          <TextField
            label="说明（可选）"
            value={block.caption ?? ""}
            onChange={(caption) =>
              dispatch({
                type: "block",
                index,
                block: { ...block, caption: caption || undefined },
              })
            }
          />
        </div>
      );
      break;
    case "code":
      editor = (
        <div className="grid gap-2">
          <TextField
            label="语言"
            value={block.language}
            onChange={(language) =>
              dispatch({
                type: "block",
                index,
                block: { ...block, language },
              })
            }
          />
          <textarea
            aria-label="代码内容"
            value={block.code}
            onChange={(event) =>
              dispatch({
                type: "block",
                index,
                block: { ...block, code: event.target.value },
              })
            }
            rows={6}
            className="rounded-md border border-border bg-slate-950 px-2 py-1.5 font-mono text-sm text-slate-100"
          />
        </div>
      );
      break;
  }

  return (
    <li className="rounded-xl border border-border bg-background/70 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <strong className="text-sm text-card-foreground">
          {index + 1}. {block.type}
        </strong>
        <div className="flex flex-wrap gap-1">
          <button
            type="button"
            onClick={() => dispatch({ type: "move", index, direction: -1 })}
            className="rounded border border-border px-2 py-1 text-xs"
          >
            上移
          </button>
          <button
            type="button"
            onClick={() => dispatch({ type: "move", index, direction: 1 })}
            className="rounded border border-border px-2 py-1 text-xs"
          >
            下移
          </button>
          <button
            type="button"
            onClick={() => dispatch({ type: "copy", index })}
            className="rounded border border-border px-2 py-1 text-xs"
          >
            复制
          </button>
          <button
            type="button"
            onClick={() => dispatch({ type: "remove", index })}
            className="rounded border border-destructive/30 px-2 py-1 text-xs text-destructive"
          >
            删除
          </button>
        </div>
      </div>
      {editor}
      <div className="mt-3 rounded-lg bg-muted/60 p-3 text-sm">
        <Preview block={block} />
      </div>
    </li>
  );
}

async function decodeApiResponse(response: Response) {
  const payload = (await response.json().catch(() => null)) as ApiPayload | null;
  if (!response.ok || !payload?.data) {
    return {
      post: null,
      code: payload?.error?.code ?? "REQUEST_FAILED",
      message: payload?.error?.message ?? "请求失败，请稍后重试",
    };
  }
  return { post: payload.data, code: null, message: null };
}

function writeFields(draft: Draft) {
  return {
    slug: draft.slug,
    title: draft.title,
    excerpt: draft.excerpt,
    category: draft.category?.slug ?? null,
    tags: draft.tags.map((tag) => tag.slug),
    cover: draft.cover,
    featured: draft.featured,
    body: normalizeBodyForUpdate(draft.body),
  };
}

function Editor({ post }: { post?: OwnerPost }) {
  const router = useRouter();
  const creating = !post;
  const initial = post ? initialDraft(post) : newPostDraft;
  const [state, dispatch] = useReducer(reducer, {
    server: initial,
    draft: initial,
    status: post?.status ?? "draft",
    saving: false,
    message: null,
    conflict: false,
  });
  const [newType, setNewType] = useState<ContentBlock["type"]>("paragraph");
  const dirty = JSON.stringify(state.server) !== JSON.stringify(state.draft);
  const slugImmutable = state.status === "published" || Boolean(post?.publishedAt);

  async function persistDraft(): Promise<OwnerPost | null> {
    dispatch({ type: "saving" });
    try {
      const response = await fetch(
        creating ? "/api/v1/me/posts" : `/api/v1/me/posts/${post.id}`,
        {
          method: creating ? "POST" : "PATCH",
          headers: {
            "Content-Type": "application/json",
            Origin: window.location.origin,
          },
          body: JSON.stringify({
            ...(!creating ? { version: state.draft.version } : {}),
            ...writeFields(state.draft),
          }),
        },
      );
      const result = await decodeApiResponse(response);
      if (!result.post) {
        dispatch({
          type: "error",
          message: result.message,
          conflict: result.code === "VERSION_CONFLICT",
        });
        return null;
      }
      dispatch({
        type: "saved",
        post: result.post,
        message: creating ? "草稿创建成功，正在打开编辑页…" : "保存成功",
      });
      if (creating) {
        router.replace(routes.accountPostEdit(result.post.id));
        router.refresh();
      }
      return result.post;
    } catch {
      dispatch({ type: "error", message: "网络暂时不可用，请稍后重试" });
      return null;
    }
  }

  async function publish() {
    if (!post) return;
    let version = state.draft.version;
    if (dirty) {
      const saved = await persistDraft();
      if (!saved) return;
      version = saved.version;
    }

    dispatch({ type: "saving" });
    try {
      const response = await fetch(`/api/v1/me/posts/${post.id}/publish`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: window.location.origin,
        },
        body: JSON.stringify({ version }),
      });
      const result = await decodeApiResponse(response);
      if (!result.post) {
        dispatch({
          type: "error",
          message: result.message,
          conflict: result.code === "VERSION_CONFLICT",
        });
        return;
      }
      dispatch({ type: "saved", post: result.post, message: "文章发布成功" });
      router.refresh();
    } catch {
      dispatch({ type: "error", message: "网络暂时不可用，请稍后重试" });
    }
  }

  function addBlock() {
    const blocks: Record<ContentBlock["type"], ContentBlock> = {
      heading: {
        type: "heading",
        level: 2,
        id: "new-section",
        text: "新标题",
      },
      paragraph: {
        type: "paragraph",
        children: [{ type: "text", value: "新段落" }],
      },
      list: { type: "list", ordered: false, items: ["新条目"] },
      quote: { type: "quote", text: "新的引用" },
      image: {
        type: "image",
        image: {
          src: "/images/placeholders/article-inline.svg",
          alt: "图片",
          width: 1200,
          height: 675,
        },
      },
      code: { type: "code", language: "text", code: "新代码" },
    };
    const block = blocks[newType];
    dispatch({
      type: "add",
      block:
        block.type === "heading"
          ? {
              ...block,
              id: nextHeadingId(state.draft.body, "new-section"),
            }
          : block,
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <section className="glass-card p-5 sm:p-8">
        <div className="grid gap-4">
          <label className="grid gap-1 text-sm font-semibold">
            slug
            <input
              value={state.draft.slug}
              disabled={slugImmutable}
              onChange={(event) =>
                dispatch({
                  type: "set",
                  field: "slug",
                  value: event.target.value
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, "-")
                    .replace(/^-|-$/g, ""),
                })
              }
              placeholder="my-first-post"
              className="rounded-lg border border-border bg-background px-3 py-2 text-base disabled:cursor-not-allowed disabled:opacity-60"
            />
            <span className="text-xs font-normal text-muted-foreground">
              {slugImmutable
                ? "文章发布后 slug 不可修改。"
                : "仅使用小写字母、数字和连字符。"}
            </span>
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            标题
            <input
              value={state.draft.title}
              onChange={(event) =>
                dispatch({
                  type: "set",
                  field: "title",
                  value: event.target.value,
                })
              }
              className="rounded-lg border border-border bg-background px-3 py-2 text-base"
            />
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            摘要
            <textarea
              value={state.draft.excerpt ?? ""}
              onChange={(event) =>
                dispatch({
                  type: "set",
                  field: "excerpt",
                  value: event.target.value || null,
                })
              }
              rows={3}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm font-semibold">
              分类 slug
              <input
                value={state.draft.category?.slug ?? ""}
                onChange={(event) =>
                  dispatch({
                    type: "set",
                    field: "category",
                    value: event.target.value
                      ? {
                          slug: event.target.value,
                          name:
                            state.draft.category?.name ?? event.target.value,
                        }
                      : null,
                  })
                }
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
            </label>
            <label className="grid gap-1 text-sm font-semibold">
              标签 slug（逗号分隔）
              <input
                value={state.draft.tags.map((tag) => tag.slug).join(", ")}
                onChange={(event) =>
                  dispatch({
                    type: "set",
                    field: "tags",
                    value: event.target.value
                      .split(",")
                      .map((slug) => slug.trim())
                      .filter(Boolean)
                      .map((slug) => ({ slug, name: slug })),
                  })
                }
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
            </label>
          </div>
          <div className="grid gap-3 rounded-lg border border-border p-3">
            <p className="text-sm font-semibold">封面（发布前必填）</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <input
                aria-label="封面 URL"
                value={state.draft.cover?.src ?? ""}
                onChange={(event) =>
                  dispatch({
                    type: "set",
                    field: "cover",
                    value: event.target.value
                      ? {
                          ...(state.draft.cover ?? {
                            alt: "封面",
                            width: 1200,
                            height: 675,
                          }),
                          src: event.target.value as ImageSource,
                        }
                      : null,
                  })
                }
                placeholder="/images/..."
                className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
              />
              <input
                aria-label="封面替代文本"
                value={state.draft.cover?.alt ?? ""}
                onChange={(event) =>
                  state.draft.cover &&
                  dispatch({
                    type: "set",
                    field: "cover",
                    value: {
                      ...state.draft.cover,
                      alt: event.target.value,
                    },
                  })
                }
                placeholder="替代文本"
                className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={state.draft.featured}
              onChange={(event) =>
                dispatch({
                  type: "set",
                  field: "featured",
                  value: event.target.checked,
                })
              }
            />
            设为精选
          </label>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold">正文 blocks</h2>
          <div className="flex gap-2">
            <select
              aria-label="新 block 类型"
              value={newType}
              onChange={(event) =>
                setNewType(event.target.value as ContentBlock["type"])
              }
              className="rounded-lg border border-border bg-background px-2 py-2 text-sm"
            >
              <option value="heading">heading</option>
              <option value="paragraph">paragraph</option>
              <option value="list">list</option>
              <option value="quote">quote</option>
              <option value="image">image</option>
              <option value="code">code</option>
            </select>
            <button
              type="button"
              onClick={addBlock}
              className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"
            >
              添加 block
            </button>
          </div>
        </div>
        <ol className="mt-4 grid gap-3">
          {state.draft.body.map((block, index) => (
            <BlockEditor
              key={`${index}-${block.type}`}
              block={block}
              index={index}
              dispatch={dispatch}
            />
          ))}
        </ol>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
          <p
            role="status"
            className={`text-sm ${
              state.conflict ? "text-destructive" : "text-muted-foreground"
            }`}
          >
            {state.message ??
              (creating
                ? "填写标题和 slug 后创建草稿"
                : dirty
                  ? "有未保存的修改"
                  : "已保存")}
            {state.conflict
              ? " 本地修改已保留，请刷新后手动合并。"
              : ""}
          </p>
          <div className="flex flex-wrap gap-2">
            {!creating && state.status === "draft" ? (
              <button
                type="button"
                disabled={state.saving}
                onClick={publish}
                className="rounded-lg border border-primary px-4 py-2 text-sm font-bold text-primary disabled:cursor-not-allowed disabled:opacity-50"
              >
                {state.saving ? "处理中…" : "保存并发布"}
              </button>
            ) : null}
            <button
              type="button"
              disabled={state.saving || (!creating && !dirty)}
              onClick={persistDraft}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
            >
              {state.saving
                ? "保存中…"
                : creating
                  ? "创建草稿"
                  : "保存文章"}
            </button>
          </div>
        </div>
      </section>

      <aside className="glass-card h-fit p-5">
        <h2 className="font-bold">预览</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {creating ? "新草稿" : `版本 ${state.draft.version}`} · slug{" "}
          {state.draft.slug || "未填写"}
        </p>
        <div className="mt-4">
          {state.draft.body.map((block, index) => (
            <Preview key={index} block={block} />
          ))}
        </div>
      </aside>
    </div>
  );
}

export function PostEditor({ post }: { post: OwnerPost }) {
  return <Editor post={post} />;
}

export function NewPostEditor() {
  return <Editor />;
}
