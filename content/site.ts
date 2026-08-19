import type { SiteConfig } from "@/lib/content/types";

const siteUrl =
  process.env.SITE_URL?.trim() ||
  process.env.APP_ORIGIN?.trim() ||
  "http://localhost:3000";

export const siteConfig = {
  name: "棱镜手记",
  description: "记录设计、代码与日常观察的独立博客。",
  siteUrl,
  logo: {
    src: "/images/brand/logo.svg",
    alt: "棱镜手记标志",
    width: 96,
    height: 96,
  },
  author: {
    name: "林屿",
    role: "独立开发者与设计爱好者",
    bio: "在界面、代码和日常观察之间，收集那些值得反复琢磨的小事。",
    avatar: {
      src: "/images/brand/avatar.svg",
      alt: "作者的抽象头像",
      width: 240,
      height: 240,
    },
    links: [
      { label: "GitHub", href: "https://github.com/" },
      { label: "Next.js", href: "https://nextjs.org/" },
    ],
  },
  announcement:
    "这里是一座持续生长的小型知识花园。所有内容均为布局演示用的中性占位信息。",
  navigation: [
    { href: "/", label: "首页" },
    { href: "/archives", label: "归档" },
    { href: "/tags", label: "标签" },
    { href: "/categories", label: "分类" },
    { href: "/about", label: "关于" },
  ],
  categories: [
    { slug: "frontend", name: "前端札记" },
    { slug: "backend", name: "服务端" },
    { slug: "design", name: "设计观察" },
    { slug: "tools", name: "效率工具" },
    { slug: "life", name: "生活随笔" },
  ],
  tags: [
    { slug: "nextjs", name: "Next.js" },
    { slug: "typescript", name: "TypeScript" },
    { slug: "react", name: "React" },
    { slug: "css", name: "CSS" },
    { slug: "accessibility", name: "可访问性" },
    { slug: "architecture", name: "架构" },
    { slug: "workflow", name: "工作流" },
    { slug: "reading", name: "阅读" },
    { slug: "photography", name: "摄影" },
    { slug: "reflection", name: "思考" },
  ],
  about: {
    greeting: "你好，我是林屿",
    title: "把复杂的问题，整理成清楚的形状。",
    summary:
      "这是一份用于验证博客布局与交互的中性介绍。它不对应任何真实人物或参考网站作者。",
    skills: ["Next.js", "TypeScript", "Design Systems", "Writing", "Photography"],
    facts: [
      { value: "6+", label: "示例文章" },
      { value: "5", label: "内容分类" },
      { value: "∞", label: "持续好奇" },
    ],
    sections: [
      {
        title: "关于这座小站",
        body: "棱镜手记用于记录技术实验、界面观察和日常片段。内容只是可替换的结构化样本，重点是展示稳定、清晰的阅读体验。",
      },
      {
        title: "关注的方向",
        body: "我关心可维护的前端架构、克制的视觉表达和对所有人都友好的交互。比起堆叠功能，更喜欢寻找恰到好处的边界。",
      },
      {
        title: "保持联系",
        body: "如果这些主题也让你感兴趣，可以通过页面中的公开技术入口继续探索。没有有效目标的社交链接不会在本站展示。",
      },
    ],
  },
} satisfies SiteConfig;
