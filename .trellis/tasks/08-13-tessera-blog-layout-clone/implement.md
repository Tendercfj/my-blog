# Tessera Blog 布局样式复刻实施计划

## 1. 文档信息

| 项目 | 内容 |
| --- | --- |
| 需求基线 | `prd.md`，AC1–AC20 |
| 技术基线 | `design.md`，Next.js 16 全栈静态内容方案 |
| 当前任务 | `08-13-tessera-blog-layout-clone` |
| 当前状态 | Planning；等待用户评审 |
| 计划日期 | 2026-08-17 |
| 实施方式 | 分阶段增量实现、阶段内验证、最终浏览器验收 |

本文件只定义执行顺序、质量门和回滚点，不授权本轮开始产品代码实现。本轮不运行 `task.py start`，不修改 `app/`、`components/`、`content/`、`lib/` 或 `public/` 下的产品文件。

## 2. 实施目标与边界

### 2.1 目标

- 基于现有 Next.js 16 App Router 项目完成 PRD 中 8 类路由和 AC1–AC20。
- 复刻参考站的信息架构、模块顺序、布局比例、玻璃卡片语言、响应式行为和核心交互，不复制其文章、作者资料或版权资产。
- 采用本地强类型内容、Server Components、构建时预渲染和小型 Client Components 交互岛。
- 让内容计数、归档、taxonomy、搜索索引、详情和 SEO 元信息来自同一 repository。

### 2.2 不在本次实施范围

- CMS、数据库、认证、后台、评论、订阅、真实统计和业务写入 API。
- Route Handlers、Server Actions、Middleware、全局状态库和 `output: "export"`。
- 参考站正文、个人资料、Logo、图片、统计接口或其他版权资产的复制与热链。
- P1 的布局偏好、TOC 滚动高亮、图片预览和复杂进入动效。
- 自动化像素差截图测试框架；本期使用固定视口人工截图和交互走查。

## 3. 前置条件与启动门

只有以下条件全部满足后才能进入 Phase 0：

- [ ] 用户明确批准最新的 `prd.md`、`design.md` 和本 `implement.md`。
- [ ] 运行 `trellis-before-dev`，读取实现涉及层级的最新规范；当前 `.trellis/spec/frontend/` 仍为 bootstrap 状态，不能臆造不存在的项目约定。
- [ ] 确认 Trellis dispatch mode；inline 模式跳过 JSONL 编排，sub-agent 模式先补全 `implement.jsonl` 和 `check.jsonl`。
- [ ] 运行 `rtk python3 ./.trellis/scripts/task.py validate 08-13-tessera-blog-layout-clone`。
- [ ] 用户批准后运行 `rtk python3 ./.trellis/scripts/task.py start 08-13-tessera-blog-layout-clone`，确认任务状态变为 `in_progress`。
- [ ] 记录基线 `rtk pnpm lint`、`rtk pnpm exec tsc --noEmit`、`rtk pnpm build` 结果；基线失败需先区分既有问题与本任务引入问题。
- [ ] 再次确认工作目录不是 Git 仓库的事实；实施期间对既有文件使用文件级检查点，不能依赖 `git checkout` 或提交回滚。

## 4. 预计影响文件

以下是计划范围，不要求机械地一次性创建；实现中若发现更小的合理拆分，可在不改变契约的前提下合并同领域组件。

### 4.1 修改既有文件

| 文件 | 变更 |
| --- | --- |
| `app/layout.tsx` | 改为全站 RootLayout、metadata、主题启动脚本和公共 shell |
| `app/page.tsx` | 将默认页面改为博客首页 |
| `app/globals.css` | 语义 tokens、主题、断点、玻璃卡片、正文排版、focus 和 reduced-motion |
| `package.json` | 仅在确认需要时加入直接依赖 `server-only` |
| `pnpm-lock.yaml` | 与依赖变更同步 |

不使用 `(site)` route group，不移动或删除现有 `app/page.tsx`。如实现阶段确需删除任何既有文件，必须暂停并先获得用户批准。

### 4.2 新增路由文件

```text
app/
├── archives/page.tsx
├── tags/page.tsx
├── tags/[slug]/page.tsx
├── categories/page.tsx
├── categories/[slug]/page.tsx
├── about/page.tsx
├── posts/[slug]/page.tsx
├── not-found.tsx
├── error.tsx
├── sitemap.ts
└── robots.ts
```

### 4.3 新增领域与组件文件

```text
content/
├── site.ts
└── posts.ts

lib/
├── content/types.ts
├── content/derive.ts
├── content/validate.ts
├── content/repository.ts
├── content/search.ts
├── metadata.ts
├── routes.ts
└── date.ts

components/
├── site/*
├── home/*
├── blog/*
├── sidebar/*
├── search/*
├── theme/*
└── ui/*

public/images/
├── brand/*
├── posts/*
└── placeholders/*
```

## 5. 有序实施清单

各 Phase 必须按顺序执行；上一个 Phase 的完成定义未满足时，不进入下一个 Phase。

### Phase 0：激活任务与建立基线

- [ ] 完成第 3 节启动门并记录三条基线命令的真实结果。
- [ ] 用 `rtk rg --files app components lib content public` 记录实施前文件集合；不存在的目录单独标注，不把命令空结果视为失败。
- [ ] 为 `app/layout.tsx`、`app/page.tsx`、`app/globals.css`、`package.json` 和 `pnpm-lock.yaml` 记录实施前文件级检查点。
- [ ] 检查 `@base-ui/react` 当前版本导出的 `Dialog` 与 `Drawer` API，按已安装版本实现，不套用其他版本示例。
- [ ] 若使用 `import "server-only"`，执行 `rtk pnpm add server-only` 并确认它成为直接 dependency；依赖下载需要权限时按环境流程申请。

完成定义：任务为 `in_progress`；既有基线和可恢复文件清单已记录；依赖决策明确；没有产品行为变化。

回滚点：恢复 `package.json` / `pnpm-lock.yaml` 检查点或移除本阶段新增依赖；任务文档保留作为审计记录。

### Phase 1：内容模型、repository 与本地资产

- [ ] 在 `lib/content/types.ts` 建立 `SiteConfig`、`PostRecord`、`PostSummary`、`PostDetail`、`ContentBlock`、taxonomy、归档、统计和搜索类型。
- [ ] 在 `content/site.ts` 编写中性站点配置、导航、作者占位、公告和关于页内容。
- [ ] 在 `content/posts.ts` 编写至少 6 篇、跨至少 2 年、覆盖至少 5 个分类和 10 个标签的结构化占位文章。
- [ ] 使用 `apply_patch` 创建自有抽象 SVG/渐变占位资产，保存到 `public/images/`；不得下载或引用参考站资产。
- [ ] 在 `derive.ts` 集中实现稳定排序、taxonomy 计数、年份归档、字数、阅读时长、TOC 与上一篇/下一篇派生。
- [ ] 在 `validate.ts` 校验 slug、日期、taxonomy 引用、heading id、链接协议、图片路径/尺寸和本地文件存在性，错误信息包含文章 slug 或字段路径。
- [ ] 在 `repository.ts` 实现 `design.md` 约定的只读异步查询接口；页面不得直接导入 `content/posts.ts`。
- [ ] 在 `search.ts` 生成不含正文和图片对象的 `SearchDocument[]`。
- [ ] 通过临时坏数据或最小可执行入口验证：重复 slug、未知 taxonomy、非法日期和缺失图片能阻止构建；验证后恢复合法数据。

完成定义：内容只有一个事实来源；列表、统计、归档和 taxonomy 计数一致；有效/未知/合法空 taxonomy 三种状态可区分；不存在参考站 URL。

回滚点：移除本 Phase 新增的 `content/`、`lib/content/` 和本地占位资产，不改动 Phase 0 检查点文件。

### Phase 2：全局视觉系统与公共站点 shell

- [ ] 重构 `app/globals.css`，建立浅/深色语义 tokens、`600/768/900/1024px` 响应式层级、玻璃卡片、页面背景、文章排版、focus-visible 和 reduced-motion。
- [ ] 统一根主题为 `data-theme="light|dark"`，迁移现有 `.dark` 与系统媒体查询，避免两套主题状态并存。
- [ ] 重构 `app/layout.tsx`：设置 `lang="zh-CN"`、system font stack、skip link、唯一 `main`、ThemeBootScript、Header、Footer、SearchProvider、背景与浮动工具。
- [ ] 实现 `SiteHeader`、桌面导航、当前路由激活态和约 `56px` 固定玻璃导航。
- [ ] 使用 Base UI Drawer 实现移动菜单，覆盖 focus trap、`Escape`、关闭按钮、路由后关闭和滚动锁定。
- [ ] 使用 Base UI Dialog 实现搜索弹层；支持输入聚焦、空输入、无结果、加权匹配、结果跳转和焦点返回。
- [ ] 实现主题首屏脚本、主题切换、系统偏好和 `localStorage` 持久化，检查无明显错误主题闪烁。
- [ ] 实现 Footer、SiteBackground、FloatingTools 和回到顶部阈值；reduced-motion 下使用即时滚动。
- [ ] 确保只有导航激活态、菜单、搜索、主题和浮动工具声明 `"use client"`。

完成定义：空内容页也能展示完整公共 shell；桌面/移动导航、搜索、主题、Footer 和浮动工具可独立走查；键盘焦点无丢失；无水平溢出。

回滚点：恢复 `app/layout.tsx` 与 `app/globals.css` 的 Phase 0 检查点，移除本 Phase 新增的公共组件；保留 Phase 1 内容层。

### Phase 3：首页与可复用双栏组件

- [ ] 实现 `StandardTwoColumnLayout` 和 `FullWidthLayout`，桌面主侧栏接近 3:1，`<=900px` 进入单列。
- [ ] 实现首页组合 Hero：主视觉、三张分类入口、深色推荐卡；移动端顺序为主视觉、分类入口、推荐卡。
- [ ] 实现两列 `PostGrid` / `PostCard`，`<=768px` 单列，图片固定比例且有明确尺寸。
- [ ] 实现 `BlogSidebar` 及作者、公告、最新文章、分类、标签、归档和站点统计模块；统计只来自 repository。
- [ ] 改写 `app/page.tsx` 组装首页，不把 Server Component 页面改成 Client Component。
- [ ] 检查卡片完整点击区域、hover/focus-visible、标题摘要截断与 sticky 降级。

完成定义：首页在三档验收视口中模块顺序正确；桌面两列文章和右侧栏成立；移动端顺序及宽度正确；至少 6 篇文章可进入详情 URL。

回滚点：恢复 `app/page.tsx` 的 Phase 0 检查点并移除 `components/home/` 与本阶段新增布局/侧栏组件；公共 shell 与内容层不回滚。

### Phase 4：归档、标签与分类路由

- [ ] 实现归档时间线组件，按年份降序、年份内按日期降序展示文章。
- [ ] 实现 `/archives`，包含文章总数、跨年至少两个年份和公共侧栏。
- [ ] 实现 `/tags` 彩色计数胶囊云，色板固定且浅/深主题可读。
- [ ] 实现 `/categories` 纵向计数列表，具备 hover、focus-visible 和计数。
- [ ] 实现 `/tags/[slug]` 与 `/categories/[slug]`，复用时间线和双栏框架。
- [ ] 动态路由实现 `generateStaticParams()`、`dynamicParams = false` 和 `generateMetadata()`；查询规则只来自 repository。
- [ ] 未知 slug 调用 `notFound()`；配置内计数为零的合法 taxonomy 显示卡片化空状态与返回入口。

完成定义：聚合数据与首页/详情计数一致；有效动态路由可直接刷新；未知与合法空状态明确区分；每页只有一个 `h1`。

回滚点：移除本 Phase 新增路由及 taxonomy/时间线表现组件；不修改 Phase 1 repository 契约。

### Phase 5：关于页、文章详情与错误状态

- [ ] 实现 `/about` 独立全宽布局：头像/图形占位、问候、技能、有效社交入口、三列事实和至少三节正文。
- [ ] 实现文章封面标题卡、元信息、正文卡、标签、版权占位和上一篇/下一篇导航。
- [ ] 为全部 `ContentBlock` 建立穷尽渲染：`h2/h3`、段落、链接、列表、引用、图片、行内代码和代码块。
- [ ] 服务端渲染代码文本与语言标签，复制按钮作为最小 Client Component；成功/失败反馈使用 `aria-live="polite"`。
- [ ] 实现静态 TOC 与锚点；标题设置固定导航所需的 `scroll-margin-top`。
- [ ] 实现 `/posts/[slug]` 的 `generateStaticParams()`、`dynamicParams = false`、`generateMetadata()` 和 `notFound()`。
- [ ] 实现 `app/not-found.tsx` 与 `app/error.tsx`；错误页不泄露内部错误，提供重试/返回入口。
- [ ] 检查外链协议与 `rel="noopener noreferrer"`，确认未使用 `dangerouslySetInnerHTML`。

完成定义：所有正文 block 可见且语义层级正确；复制成功/失败不会中断页面；文章、标签、分类未知 slug 使用统一 404；关于页不出现常规侧栏。

回滚点：移除本 Phase 的新增页面和组件；聚合路由、首页、公共 shell 与内容层保持可运行。

### Phase 6：SEO、sitemap 与 robots

- [ ] 在根 layout 配置 `metadataBase`、title template、description、Open Graph 和 Twitter 基线。
- [ ] `SITE_URL` 生产环境必须为绝对 `https` URL；开发环境只回退 `http://localhost:3000`。
- [ ] 为固定页面与详情页提供独立 metadata，详情数据复用 repository。
- [ ] 实现 `app/sitemap.ts`，覆盖固定路由、文章、标签与分类，更新时间来自内容。
- [ ] 实现 `app/robots.ts` 并指向 sitemap。
- [ ] 首页输出 `WebSite` / `Blog` JSON-LD，文章页输出 `BlogPosting` JSON-LD；只序列化受控本地对象。

完成定义：构建能生成 metadata、sitemap 与 robots；所有 canonical 来源唯一；无硬编码参考站域名或 Preview 域名。

回滚点：移除 SEO helper、`sitemap.ts`、`robots.ts` 和 JSON-LD 组装，恢复根 layout metadata 部分到 Phase 5 可用状态。

### Phase 7：静态质量门与浏览器验收

- [ ] 依次运行 `rtk pnpm lint`、`rtk pnpm exec tsc --noEmit`、`rtk pnpm build`，修复本任务引入的全部错误。
- [ ] 从构建输出确认固定页和动态 slug 均被预渲染；逐个直接访问并刷新有效路由。
- [ ] 使用 `rtk pnpm run dev` 启动本地站点，通过浏览器完成第 7 节矩阵。
- [ ] 校验无效文章、标签、分类 slug 的 404，以及合法空 taxonomy 的空状态。
- [ ] 搜索代码与浏览器 Network，确认不存在 `tessera-blog.vercel.app` 请求或远程图片热链。
- [ ] 检查浅/深主题刷新保持、移动菜单、搜索、复制、回到顶部和 reduced-motion。
- [ ] 检查主流浏览器降级风险：无 `backdrop-filter` 时信息仍可读，Clipboard 不可用时正文仍可选择。

完成定义：AC1–AC20 全部获得命令输出、页面行为或截图证据；没有把“应当通过”写成验证结果。

回滚点：按首次失败所属 Phase 回滚，不在最终阶段同时大范围重写多个层级；回滚后重新运行三条静态质量命令。

### Phase 8：Trellis 质量检查与收尾

- [ ] 运行 `trellis-check`，核对 PRD、design、实现、lint、typecheck、build、跨层数据流和重复代码。
- [ ] 评估是否将实际形成的稳定约定写入 `.trellis/spec/frontend/`；只有代码库已验证的约定才更新 spec。
- [ ] 在任务记录中关联三档截图、质量命令结果、已知限制和未完成项。
- [ ] 只有全部 P0 验收通过后才进入 `trellis-finish-work`；归档、提交、推送或 PR 操作仍遵循用户授权和当前无 Git 事实。

完成定义：任务成果、验证证据、风险与后续项完整；没有把 P1 混入 P0 完成标准。

## 6. 每阶段持续检查

每完成一个 Phase，执行以下最小检查，避免把问题积累到最终构建：

```bash
rtk pnpm lint
rtk pnpm exec tsc --noEmit
rtk pnpm build
```

执行规则：

- `lint` 或 `tsc` 失败时停止新增功能，先修复当前 Phase。
- `build` 必须覆盖内容校验、Server/Client 边界、metadata 和静态参数。
- 若失败与基线相同，记录证据并说明归属；不得把既有失败宣称为本任务通过。
- 开发服务器使用 `rtk pnpm run dev`；浏览器验收结束后正常停止进程。
- 当前不引入测试框架。若 `derive.ts` / `validate.ts` 的分支复杂度无法通过最小构建检验覆盖，先更新本计划并经用户确认后再引入轻量测试依赖。

## 7. 浏览器验证矩阵

| 页面/能力 | `1440 × 900` | `1024 × 768` | `390 × 844` | 深色模式 | 键盘/交互 |
| --- | --- | --- | --- | --- | --- |
| 首页 | 必测并截图 | 必测并截图 | 必测并截图 | 必测 | 导航、搜索、菜单、主题、返回顶部 |
| 文章详情 | 必测并截图 | 必测并截图 | 必测并截图 | 必测 | TOC、链接、复制成功/失败 |
| `/archives` 或 taxonomy 详情 | 必测并截图 | 抽查 | 必测并截图 | 抽查 | 时间线、无效 slug、空状态 |
| `/tags` 与 `/categories` | 必测 | 抽查 | 必测 | 抽查 | 胶囊/列表 focus-visible |
| `/about` | 必测 | 抽查 | 必测 | 抽查 | 社交链接与标题层级 |

每个视口同时记录：

- [ ] `document.documentElement.scrollWidth <= window.innerWidth`。
- [ ] 固定导航未遮挡页面 `h1` 或正文锚点。
- [ ] 图片比例稳定，无明显 CLS、拉伸或容器坍塌。
- [ ] Dialog/Drawer 可通过按钮、外部点击（组件允许时）和 `Escape` 关闭，背景滚动受控，焦点返回触发器。
- [ ] 主题切换后刷新仍保持，首屏无明显错误主题闪烁。
- [ ] 关闭动画或模拟 `prefers-reduced-motion: reduce` 后，核心功能仍正常。
- [ ] Network 的请求主机中不存在 `tessera-blog.vercel.app`，图片均来自本地 `/images/`。

## 8. AC1–AC20 实施与证据映射

| AC | 主要实施 Phase | 必需证据 |
| --- | --- | --- |
| AC1 | 3–6 | 构建路由输出 + 全部有效路由直接访问/刷新 |
| AC2 | 4–5 | 无效 post/tag/category slug 截图 + 合法空状态截图 |
| AC3 | 1–7 | `rg` 代码检查 + Network 主机检查 + 本地资产清单 |
| AC4 | 1、3–5 | 同一内容集的首页/归档/taxonomy/侧栏计数对照 |
| AC5 | 2–3 | `1440 × 900` 首页截图 |
| AC6 | 2–5 | 双栏宽度、间距和共享卡片样式截图 |
| AC7 | 3–5 | 标签、分类、关于和文章详情截图 |
| AC8 | 3–7 | 与参考站并排的结构/比例人工评审记录 |
| AC9 | 2–5 | `1024 × 768` 首页、详情与聚合页截图 |
| AC10 | 2–5 | `390 × 844` 截图 + scrollWidth 检查 |
| AC11 | 2、7 | 移动 Drawer/Search Dialog 的 Escape、滚动锁、焦点返回走查 |
| AC12 | 2、7 | 浅/深截图 + 刷新持久化走查 |
| AC13 | 2–5 | hover、focus-visible、active 状态走查 |
| AC14 | 1–2 | 搜索空输入、无结果、标题/摘要/标签/分类命中与跳转 |
| AC15 | 5、7 | 全部 ContentBlock 截图 + 复制成功/失败反馈 |
| AC16 | 2、7 | 返回顶部 + reduced-motion 走查 |
| AC17 | 7 | `rtk pnpm lint` 退出码与输出 |
| AC18 | 7 | `rtk pnpm build` 退出码、TypeScript 与路由输出 |
| AC19 | 7 | 三档视口截图清单 |
| AC20 | 2、5、7 | 完整键盘走查记录 |

## 9. 高风险点与控制措施

| 风险 | 控制措施 | 触发回滚条件 |
| --- | --- | --- |
| 无 Git，既有文件难恢复 | Phase 0 建立文件级检查点；每 Phase 限定影响文件 | 现有页面/配置被不可定位地覆盖 |
| RootLayout 过度客户端化 | Provider 只包必要交互，内容与卡片保持 Server Components | 页面主体进入客户端 bundle 或出现 hydration 错误 |
| 内容派生不一致 | 页面只读 repository，禁止直接读原始 posts 或手写计数 | 任意两个页面计数/排序不一致 |
| 静态路由漏生成 | repository 驱动 `generateStaticParams`，构建检查路由输出 | 有效 slug 刷新 404 或构建未预渲染 |
| 主题首屏闪烁 | 样式计算前运行有限值 ThemeBootScript | 刷新出现明显错误主题或 hydration 警告 |
| Dialog/Drawer 可访问性退化 | 使用已安装 Base UI API，实测 Escape、focus trap、焦点恢复 | 键盘无法关闭或焦点丢失 |
| 玻璃效果导致性能/兼容问题 | 限定 backdrop-filter 范围并提供不透明背景降级 | 滚动明显卡顿或文字对比不足 |
| 远程资产/版权风险 | 本地自有 SVG/渐变，代码与 Network 双检查 | 出现参考站 URL、内容或热链请求 |
| `server-only` 依赖缺失 | Phase 0 作为直接依赖安装并先构建验证 | import 无法解析或 Client Component 意外导入服务端模块 |
| 响应式水平溢出 | Grid 使用 `minmax(0, 1fr)`，每档测 scrollWidth | 任一验收视口出现非预期横向滚动 |

## 10. 回滚策略

当前项目根目录不是 Git 仓库，回滚按文件与 Phase 执行：

1. 修改既有文件前，记录原始内容、文件列表与所属 Phase；新增文件按 Phase 建立清单。
2. 验证失败时暂停后续 Phase，使用 `apply_patch` 反向恢复当前 Phase 的既有文件，并移除当前 Phase 新增内容；删除任何文件前仍需按项目安全规则获得用户批准。
3. 依赖变更通过恢复 `package.json` / `pnpm-lock.yaml` 检查点回滚，随后重新安装并验证；不手工制造不一致 lockfile。
4. 回滚后重新运行 `rtk pnpm lint`、`rtk pnpm exec tsc --noEmit`、`rtk pnpm build`，确认回到上一个质量门。
5. 如果用户后续批准初始化 Git，可把每个已通过 Phase 建立为提交级检查点；部署后使用平台上一个成功构建回退。

本任务没有数据库、远程写入、生产配置变更或不可逆外部状态，因此无需数据迁移回滚。

## 11. 启动前最终检查

- [ ] `prd.md`、`design.md`、`implement.md` 不存在互相冲突的范围、路由或数据契约。
- [ ] 实施仅包含 P0，P1 没有混入完成定义。
- [ ] 预计新增依赖仅为可选的小型边界包 `server-only`，没有大型 UI/状态/测试框架。
- [ ] 路由、内容、视觉、响应式、交互、SEO、可访问性和工程验证均映射到 AC1–AC20。
- [ ] 每个 Phase 有进入顺序、完成定义、验证与回滚点。
- [ ] 用户已看到最新规划摘要，并明确回复批准开始实现。

在最后一项完成前，任务保持 `planning`，不得运行 `task.py start` 或修改产品代码。
