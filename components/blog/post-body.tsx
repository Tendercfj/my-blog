import Image from "next/image";
import Link from "next/link";

import { CodeBlock } from "@/components/blog/code-block";
import type { ContentBlock, InlineContent, PostDetail } from "@/lib/content/types";
import { routes } from "@/lib/routes";

function Inline({ content }: { content: InlineContent }) {
  switch (content.type) {
    case "text":
      return content.value;
    case "code":
      return <code>{content.value}</code>;
    case "link":
      return content.external ? (
        <a href={content.href} target="_blank" rel="noopener noreferrer">{content.value}</a>
      ) : (
        <Link href={content.href}>{content.value}</Link>
      );
  }
}

function Block({ block }: { block: ContentBlock }) {
  switch (block.type) {
    case "heading":
      return block.level === 2 ? <h2 id={block.id}>{block.text}</h2> : <h3 id={block.id}>{block.text}</h3>;
    case "paragraph":
      return <p>{block.children.map((content, index) => <Inline key={index} content={content} />)}</p>;
    case "list": {
      const List = block.ordered ? "ol" : "ul";
      return <List>{block.items.map((item) => <li key={item}>{item}</li>)}</List>;
    }
    case "quote":
      return <blockquote><p>{block.text}</p>{block.cite ? <cite className="mt-2 block text-xs not-italic">— {block.cite}</cite> : null}</blockquote>;
    case "image":
      return (
        <figure>
          <Image src={block.image.src} alt={block.image.alt} width={block.image.width} height={block.image.height} className="h-auto w-full rounded-xl" />
          {block.caption ? <figcaption className="mt-2 text-center text-xs text-muted-foreground">{block.caption}</figcaption> : null}
        </figure>
      );
    case "code":
      return <CodeBlock language={block.language} code={block.code} />;
  }
}

export function PostBody({ post }: { post: PostDetail }) {
  return (
    <article className="glass-card p-5 sm:p-8 lg:p-10">
      <div className="prose-content mx-auto max-w-3xl">
        {post.body.map((block, index) => <Block key={block.type === "heading" ? block.id : `${block.type}-${index}`} block={block} />)}
      </div>
      <div className="mx-auto mt-10 max-w-3xl border-t border-border pt-6">
        <p className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">
          本文为博客布局演示使用的中性占位内容，可在接入真实内容源后替换。
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          {post.tags.map((tag) => <Link key={tag.slug} href={routes.tag(tag.slug)} className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary"># {tag.name}</Link>)}
        </div>
        <nav aria-label="相邻文章" className="mt-7 grid gap-3 sm:grid-cols-2">
          {post.previous ? <Link href={routes.post(post.previous.slug)} className="rounded-xl border border-border p-4 hover:border-primary/40 hover:bg-muted"><span className="text-xs text-muted-foreground">上一篇</span><strong className="mt-1 line-clamp-2 block text-sm text-card-foreground">{post.previous.title}</strong></Link> : <span />}
          {post.next ? <Link href={routes.post(post.next.slug)} className="rounded-xl border border-border p-4 text-right hover:border-primary/40 hover:bg-muted"><span className="text-xs text-muted-foreground">下一篇</span><strong className="mt-1 line-clamp-2 block text-sm text-card-foreground">{post.next.title}</strong></Link> : null}
        </nav>
      </div>
    </article>
  );
}
