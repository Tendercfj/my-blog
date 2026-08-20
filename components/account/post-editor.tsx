"use client";

import Image from "next/image";
import { useReducer, useState } from "react";

import type { ContentBlock, InlineContent, OwnerPost } from "@/lib/content/types";

type Draft = Pick<OwnerPost, "version" | "title" | "excerpt" | "category" | "tags" | "cover" | "featured" | "body">;
type State = { server: Draft; draft: Draft; saving: boolean; message: string | null; conflict: boolean };
type Action =
  | { type: "set"; field: keyof Draft; value: Draft[keyof Draft] }
  | { type: "block"; index: number; block: ContentBlock }
  | { type: "add"; block: ContentBlock }
  | { type: "remove"; index: number }
  | { type: "move"; index: number; direction: -1 | 1 }
  | { type: "copy"; index: number }
  | { type: "saving"; value: boolean }
  | { type: "saved"; draft: Draft }
  | { type: "error"; message: string; conflict?: boolean };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "set": return { ...state, draft: { ...state.draft, [action.field]: action.value }, message: null } as State;
    case "block": return { ...state, draft: { ...state.draft, body: state.draft.body.map((block, i) => i === action.index ? action.block : block) }, message: null };
    case "add": return { ...state, draft: { ...state.draft, body: [...state.draft.body, action.block] }, message: null };
    case "remove": return { ...state, draft: { ...state.draft, body: state.draft.body.length > 1 ? state.draft.body.filter((_, i) => i !== action.index) : state.draft.body }, message: null };
    case "move": {
      const target = action.index + action.direction;
      if (target < 0 || target >= state.draft.body.length) return state;
      const body = [...state.draft.body];
      [body[action.index], body[target]] = [body[target], body[action.index]];
      return { ...state, draft: { ...state.draft, body }, message: null };
    }
    case "copy": {
      const body = [...state.draft.body];
      const original = body[action.index];
      const copied = original.type === "heading"
        ? { ...original, id: `${original.id}-copy-${action.index + 1}` }
        : original;
      body.splice(action.index + 1, 0, copied);
      return { ...state, draft: { ...state.draft, body }, message: null };
    }
    case "saving": return { ...state, saving: action.value, message: null };
    case "saved": return { ...state, server: action.draft, draft: action.draft, saving: false, message: "保存成功", conflict: false };
    case "error": return { ...state, saving: false, message: action.message, conflict: action.conflict ?? false };
  }
}

function initialDraft(post: OwnerPost): Draft {
  return { version: post.version, title: post.title, excerpt: post.excerpt, category: post.category, tags: post.tags, cover: post.cover, featured: post.featured, body: post.body };
}

function updateInline(children: readonly InlineContent[], index: number, value: string): readonly InlineContent[] {
  return children.map((child, i) => i === index ? { ...child, value } : child);
}

function normalizeBodyForUpdate(body: readonly ContentBlock[]): readonly ContentBlock[] {
  return body.map((block) => {
    if (block.type === "quote") {
      return block.cite ? block : { type: "quote", text: block.text };
    }
    if (block.type === "image") {
      return block.caption ? block : { type: "image", image: block.image };
    }
    return block;
  });
}

function changeInlineType(child: InlineContent, type: InlineContent["type"]): InlineContent {
  if (type === "link") {
    return { type, value: child.value, href: child.type === "link" ? child.href : "/" };
  }
  return { type, value: child.value };
}

function Preview({ block }: { block: ContentBlock }) {
  switch (block.type) {
    case "heading": return block.level === 2 ? <h3 className="mt-4 text-xl font-bold">{block.text}</h3> : <h4 className="mt-3 text-lg font-bold">{block.text}</h4>;
    case "paragraph": return <p className="mt-3 leading-7">{block.children.map((item) => item.value).join("")}</p>;
    case "list": { const List = block.ordered ? "ol" : "ul"; return <List className="mt-3 list-inside list-disc">{block.items.map((item) => <li key={item}>{item}</li>)}</List>; }
    case "quote": return <blockquote className="mt-3 border-l-4 border-primary/40 pl-4 italic">{block.text}</blockquote>;
    case "image": return <figure className="mt-3"><Image src={block.image.src} alt={block.image.alt} width={block.image.width} height={block.image.height} className="h-auto w-full rounded-lg" />{block.caption ? <figcaption className="text-center text-xs text-muted-foreground">{block.caption}</figcaption> : null}</figure>;
    case "code": return <pre className="mt-3 overflow-auto rounded-lg bg-slate-950 p-3 text-xs text-slate-100"><code>{block.code}</code></pre>;
  }
}

function BlockEditor({ block, index, dispatch }: { block: ContentBlock; index: number; dispatch: React.Dispatch<Action> }) {
  const field = (label: string, value: string, onChange: (value: string) => void) => <label className="grid gap-1 text-xs font-semibold text-muted-foreground"><span>{label}</span><input value={value} onChange={(event) => onChange(event.target.value)} className="rounded-md border border-border bg-background px-2 py-1.5 text-sm font-normal text-card-foreground" /></label>;
  let editor: React.ReactNode;
  switch (block.type) {
    case "heading": editor = <div className="grid gap-2 sm:grid-cols-[90px_1fr]"><label className="grid gap-1 text-xs font-semibold text-muted-foreground"><span>层级</span><select value={block.level} onChange={(event) => dispatch({ type: "block", index, block: { ...block, level: Number(event.target.value) as 2 | 3 } })} className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"><option value="2">H2</option><option value="3">H3</option></select></label>{field("标题", block.text, (text) => dispatch({ type: "block", index, block: { ...block, text } }))}{field("锚点 id", block.id, (id) => dispatch({ type: "block", index, block: { ...block, id: id.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "section" } }))}</div>; break;
    case "paragraph": editor = <div className="grid gap-2">{block.children.map((child, childIndex) => <div key={childIndex} className="grid gap-1 sm:grid-cols-[90px_1fr]"><select value={child.type} onChange={(event) => dispatch({ type: "block", index, block: { ...block, children: block.children.map((item, i) => i === childIndex ? changeInlineType(item, event.target.value as InlineContent["type"]) : item) } })} className="rounded-md border border-border bg-background px-2 py-1.5 text-xs"><option value="text">文本</option><option value="link">链接</option><option value="code">行内代码</option></select><input value={child.value} onChange={(event) => dispatch({ type: "block", index, block: { ...block, children: updateInline(block.children, childIndex, event.target.value) } })} className="rounded-md border border-border bg-background px-2 py-1.5 text-sm" />{child.type === "link" ? <input aria-label="链接地址" value={child.href} onChange={(event) => dispatch({ type: "block", index, block: { ...block, children: block.children.map((item, i) => i === childIndex && item.type === "link" ? { ...item, href: event.target.value } : item) } })} className="rounded-md border border-border bg-background px-2 py-1.5 text-sm" /> : null}</div>)}<button type="button" onClick={() => dispatch({ type: "block", index, block: { ...block, children: [...block.children, { type: "text", value: "新文本" }] } })} className="text-left text-xs font-semibold text-primary">+ 添加行内文本</button></div>; break;
    case "list": editor = <div className="grid gap-2"><label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={block.ordered} onChange={(event) => dispatch({ type: "block", index, block: { ...block, ordered: event.target.checked } })} />有序列表</label>{block.items.map((item, itemIndex) => <input key={itemIndex} value={item} onChange={(event) => dispatch({ type: "block", index, block: { ...block, items: block.items.map((value, i) => i === itemIndex ? event.target.value : value) } })} className="rounded-md border border-border bg-background px-2 py-1.5 text-sm" />)}<button type="button" onClick={() => dispatch({ type: "block", index, block: { ...block, items: [...block.items, "新条目"] } })} className="text-left text-xs font-semibold text-primary">+ 添加条目</button></div>; break;
    case "quote": editor = <div className="grid gap-2">{field("引用", block.text, (text) => dispatch({ type: "block", index, block: { ...block, text } }))}{field("出处（可选）", block.cite ?? "", (cite) => dispatch({ type: "block", index, block: { ...block, cite: cite || undefined } }))}</div>; break;
    case "image": editor = <div className="grid gap-2 sm:grid-cols-2">{field("图片 URL", block.image.src, (src) => dispatch({ type: "block", index, block: { ...block, image: { ...block.image, src: src as typeof block.image.src } } }))}{field("替代文本", block.image.alt, (alt) => dispatch({ type: "block", index, block: { ...block, image: { ...block.image, alt } } }))}{field("宽度", String(block.image.width), (value) => dispatch({ type: "block", index, block: { ...block, image: { ...block.image, width: Number(value) || 1 } } }))}{field("高度", String(block.image.height), (value) => dispatch({ type: "block", index, block: { ...block, image: { ...block.image, height: Number(value) || 1 } } }))}{field("说明（可选）", block.caption ?? "", (caption) => dispatch({ type: "block", index, block: { ...block, caption: caption || undefined } }))}</div>; break;
    case "code": editor = <div className="grid gap-2">{field("语言", block.language, (language) => dispatch({ type: "block", index, block: { ...block, language } }))}<textarea value={block.code} onChange={(event) => dispatch({ type: "block", index, block: { ...block, code: event.target.value } })} rows={6} className="rounded-md border border-border bg-slate-950 px-2 py-1.5 font-mono text-sm text-slate-100" /></div>; break;
  }
  return <li className="rounded-xl border border-border bg-background/70 p-4"><div className="mb-3 flex items-center justify-between gap-2"><strong className="text-sm text-card-foreground">{index + 1}. {block.type}</strong><div className="flex flex-wrap gap-1"><button type="button" onClick={() => dispatch({ type: "move", index, direction: -1 })} className="rounded border border-border px-2 py-1 text-xs">上移</button><button type="button" onClick={() => dispatch({ type: "move", index, direction: 1 })} className="rounded border border-border px-2 py-1 text-xs">下移</button><button type="button" onClick={() => dispatch({ type: "copy", index })} className="rounded border border-border px-2 py-1 text-xs">复制</button><button type="button" onClick={() => dispatch({ type: "remove", index })} className="rounded border border-destructive/30 px-2 py-1 text-xs text-destructive">删除</button></div></div>{editor}<div className="mt-3 rounded-lg bg-muted/60 p-3 text-sm"><Preview block={block} /></div></li>;
}

export function PostEditor({ post }: { post: OwnerPost }) {
  const draft = initialDraft(post);
  const [state, dispatch] = useReducer(reducer, { server: draft, draft, saving: false, message: null, conflict: false });
  const [newType, setNewType] = useState<ContentBlock["type"]>("paragraph");
  const dirty = JSON.stringify(state.server) !== JSON.stringify(state.draft);
  async function save() {
    dispatch({ type: "saving", value: true });
    try {
      const requestBody = {
        ...state.draft,
        category: state.draft.category?.slug ?? null,
        tags: state.draft.tags.map((tag) => tag.slug),
        body: normalizeBodyForUpdate(state.draft.body),
      };
      const response = await fetch(`/api/v1/me/posts/${post.id}`, { method: "PATCH", headers: { "Content-Type": "application/json", Origin: window.location.origin }, body: JSON.stringify(requestBody) });
      if (response.ok) {
        const successPayload = await response.json() as { data: OwnerPost };
        dispatch({ type: "saved", draft: initialDraft(successPayload.data) });
        return;
      }
      const errorPayload = await response.json().catch(() => null) as { error?: { code?: string; message?: string } } | null;
      dispatch({ type: "error", message: errorPayload?.error?.message ?? "保存失败", conflict: errorPayload?.error?.code === "VERSION_CONFLICT" });
    } catch {
      dispatch({ type: "error", message: "网络暂时不可用，请稍后重试" });
    }
  }
  function addBlock() {
    const blocks: Record<ContentBlock["type"], ContentBlock> = {
      heading: { type: "heading", level: 2, id: "new-section", text: "新标题" }, paragraph: { type: "paragraph", children: [{ type: "text", value: "新段落" }] }, list: { type: "list", ordered: false, items: ["新条目"] }, quote: { type: "quote", text: "新的引用" }, image: { type: "image", image: { src: "/images/placeholders/article-inline.svg", alt: "图片", width: 1200, height: 675 } }, code: { type: "code", language: "text", code: "新代码" },
    };
    const block = blocks[newType];
    dispatch({ type: "add", block: block.type === "heading" ? { ...block, id: `new-section-${state.draft.body.length + 1}` } : block });
  }
  return <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
    <section className="glass-card p-5 sm:p-8"><div className="grid gap-4"><label className="grid gap-1 text-sm font-semibold">标题<input value={state.draft.title} onChange={(event) => dispatch({ type: "set", field: "title", value: event.target.value })} className="rounded-lg border border-border bg-background px-3 py-2 text-base" /></label><label className="grid gap-1 text-sm font-semibold">摘要<textarea value={state.draft.excerpt ?? ""} onChange={(event) => dispatch({ type: "set", field: "excerpt", value: event.target.value || null })} rows={3} className="rounded-lg border border-border bg-background px-3 py-2 text-sm" /></label><div className="grid gap-3 sm:grid-cols-2"><label className="grid gap-1 text-sm font-semibold">分类 slug<input value={state.draft.category?.slug ?? ""} onChange={(event) => dispatch({ type: "set", field: "category", value: event.target.value ? { slug: event.target.value, name: state.draft.category?.name ?? event.target.value } : null })} className="rounded-lg border border-border bg-background px-3 py-2 text-sm" /></label><label className="grid gap-1 text-sm font-semibold">标签 slug（逗号分隔）<input value={state.draft.tags.map((tag) => tag.slug).join(", ")} onChange={(event) => dispatch({ type: "set", field: "tags", value: event.target.value.split(",").map((slug) => slug.trim()).filter(Boolean).map((slug) => ({ slug, name: slug })) })} className="rounded-lg border border-border bg-background px-3 py-2 text-sm" /></label></div><div className="grid gap-3 rounded-lg border border-border p-3"><p className="text-sm font-semibold">封面（可选）</p><div className="grid gap-2 sm:grid-cols-2"><input aria-label="封面 URL" value={state.draft.cover?.src ?? ""} onChange={(event) => dispatch({ type: "set", field: "cover", value: event.target.value ? { ...(state.draft.cover ?? { alt: "封面", width: 1200, height: 675 }), src: event.target.value as `/images/${string}` } : null })} placeholder="/images/..." className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm" /><input aria-label="封面替代文本" value={state.draft.cover?.alt ?? ""} onChange={(event) => state.draft.cover && dispatch({ type: "set", field: "cover", value: { ...state.draft.cover, alt: event.target.value } })} placeholder="替代文本" className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm" /></div></div><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={state.draft.featured} onChange={(event) => dispatch({ type: "set", field: "featured", value: event.target.checked })} />设为精选</label></div><div className="mt-6 flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-bold">正文 blocks</h2><div className="flex gap-2"><select value={newType} onChange={(event) => setNewType(event.target.value as ContentBlock["type"])} className="rounded-lg border border-border bg-background px-2 py-2 text-sm"><option value="heading">heading</option><option value="paragraph">paragraph</option><option value="list">list</option><option value="quote">quote</option><option value="image">image</option><option value="code">code</option></select><button type="button" onClick={addBlock} className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground">添加 block</button></div></div><ol className="mt-4 grid gap-3">{state.draft.body.map((block, index) => <BlockEditor key={`${index}-${block.type}`} block={block} index={index} dispatch={dispatch} />)}</ol><div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5"><p className={`text-sm ${state.conflict ? "text-destructive" : "text-muted-foreground"}`}>{state.message ?? (dirty ? "有未保存的修改" : "已保存")} {state.conflict ? "本地草稿已保留，请刷新后手动合并。" : ""}</p><button type="button" disabled={!dirty || state.saving} onClick={save} className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50">{state.saving ? "保存中…" : "保存文章"}</button></div></section>
    <aside className="glass-card h-fit p-5"><h2 className="font-bold">预览</h2><p className="mt-1 text-xs text-muted-foreground">版本 {state.draft.version} · slug {post.slug}</p><div className="mt-4">{state.draft.body.map((block, index) => <Preview key={index} block={block} />)}</div></aside>
  </div>;
}
