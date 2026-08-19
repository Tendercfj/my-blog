import type {
  ContentBlock,
  IsoDate,
  LocalImage,
  PostRecord,
} from "@/lib/content/types";

const inlineImage: LocalImage = {
  src: "/images/placeholders/article-inline.svg",
  alt: "由圆形与网格组成的抽象插图",
  width: 1280,
  height: 720,
};

function createBody(topic: string, code: string): readonly ContentBlock[] {
  return [
    {
      type: "paragraph",
      children: [
        { type: "text", value: `这是一段围绕${topic}展开的示例正文，用来验证长文阅读节奏、行高与链接样式。` },
        { type: "link", value: "查看 Next.js 文档", href: "https://nextjs.org/docs", external: true },
        { type: "text", value: "，也可以留意文中的" },
        { type: "code", value: "inline code" },
        { type: "text", value: "表现。" },
      ],
    },
    { type: "heading", level: 2, id: "starting-point", text: "从问题的形状开始" },
    {
      type: "paragraph",
      children: [
        { type: "text", value: "先明确边界，再选择工具。页面中的文字并不承担真实知识传播，只负责让标题、段落和留白拥有可信的长度。" },
      ],
    },
    {
      type: "list",
      ordered: false,
      items: ["先建立可以验证的最小结构", "让数据只在一个位置派生", "为窄屏与键盘操作保留清晰路径"],
    },
    {
      type: "quote",
      text: "好的结构不会抢走注意力，它只是让内容更容易被看见。",
      cite: "示例摘录",
    },
    { type: "image", image: inlineImage, caption: "用于文章排版验证的本地抽象占位图" },
    { type: "heading", level: 2, id: "small-iteration", text: "用小步迭代保持清晰" },
    {
      type: "paragraph",
      children: [
        { type: "text", value: "每次只改变一个可观察因素，并及时检查布局、类型和构建结果。这样即使出现偏差，也能迅速找到它来自哪里。" },
      ],
    },
    { type: "heading", level: 3, id: "example-code", text: "一个简单示例" },
    { type: "code", language: "ts", code },
    {
      type: "list",
      ordered: true,
      items: ["确认目标与限制", "实现最小闭环", "在真实视口中复核结果"],
    },
  ];
}

function cover(name: string, alt: string): LocalImage {
  return {
    src: `/images/posts/${name}.svg`,
    alt,
    width: 1280,
    height: 720,
  };
}

function post(input: Omit<PostRecord, "body"> & { topic: string; code: string }): PostRecord {
  const { topic, code, ...record } = input;
  return { ...record, body: createBody(topic, code) };
}

export const posts: readonly PostRecord[] = [
  post({
    slug: "calm-interface-rhythm",
    title: "为界面建立安静而稳定的节奏",
    excerpt: "从卡片、留白和层级出发，整理一套适合持续阅读的页面节奏。",
    publishedAt: "2026-07-18" as IsoDate,
    updatedAt: "2026-07-22" as IsoDate,
    category: "design",
    tags: ["css", "accessibility", "reflection"],
    cover: cover("calm-interface", "蓝紫色卡片与圆形构成的抽象界面"),
    featured: true,
    topic: "界面节奏",
    code: "const rhythm = { gap: 20, radius: 12, lineHeight: 1.8 };",
  }),
  post({
    slug: "server-first-content",
    title: "让内容从服务端自然抵达页面",
    excerpt: "用小型 repository 连接结构化内容与 Server Components。",
    publishedAt: "2026-05-09" as IsoDate,
    category: "backend",
    tags: ["nextjs", "architecture", "typescript"],
    cover: cover("server-first", "深蓝色节点连接成的服务端数据流"),
    topic: "服务端内容",
    code: "const post = await repository.getPostBySlug(slug);",
  }),
  post({
    slug: "responsive-without-surprises",
    title: "没有意外的响应式布局",
    excerpt: "用明确的断点、可收缩网格和真实视口检查避免横向溢出。",
    publishedAt: "2026-02-24" as IsoDate,
    category: "frontend",
    tags: ["css", "react", "accessibility"],
    cover: cover("responsive-layout", "不同尺寸窗口组成的响应式布局示意"),
    topic: "响应式布局",
    code: "grid-template-columns: minmax(0, 1fr) minmax(18rem, 20rem);",
  }),
  post({
    slug: "typed-content-contracts",
    title: "用类型守住内容边界",
    excerpt: "在构建时发现坏数据，让路由、搜索与统计共享同一份契约。",
    publishedAt: "2025-11-16" as IsoDate,
    category: "frontend",
    tags: ["typescript", "architecture", "nextjs"],
    cover: cover("typed-contracts", "由代码括号与数据块组成的抽象图形"),
    topic: "类型化内容",
    code: "type Result<T> = { ok: true; value: T } | { ok: false; error: string };",
  }),
  post({
    slug: "a-lighter-workflow",
    title: "给日常工作流减一点重量",
    excerpt: "减少重复切换，把验证步骤变成自然的工作节拍。",
    publishedAt: "2025-08-03" as IsoDate,
    category: "tools",
    tags: ["workflow", "reading", "reflection"],
    cover: cover("lighter-workflow", "柔和色块构成的工作流路径"),
    topic: "轻量工作流",
    code: "const nextStep = steps.find((step) => !step.done);",
  }),
  post({
    slug: "walking-with-a-camera",
    title: "带着相机慢慢走一段路",
    excerpt: "在光线与街角之间，练习观察那些容易被忽略的小变化。",
    publishedAt: "2025-03-12" as IsoDate,
    category: "life",
    tags: ["photography", "reading", "reflection", "workflow"],
    cover: cover("camera-walk", "暖色夕阳与取景框组成的抽象插图"),
    topic: "日常观察",
    code: "const frame = moments.filter((moment) => moment.light > 0.6);",
  }),
];
