# 单账号个人博客 API 契约

## 1. 文档信息

| 项目 | 内容 |
| --- | --- |
| Base path | `/api/v1` |
| 协议 | HTTPS + JSON |
| 产品模型 | 单账号个人博客，唯一站长账号 |
| 身份模型 | 自研邮箱密码认证 + opaque session Cookie |
| 数据源 | Neon PostgreSQL |
| 当前状态 | login/logout/me/register 已接入；业务页面使用 Proxy 乐观检查与数据库 session 权威保护 |

本文档中的示例域名统一使用 `https://blog.example.com`，不包含真实连接串、账号或 Secret。

## 2. 全局约定

### 2.1 JSON 与字段

- 请求和响应使用 `application/json; charset=utf-8`，字段采用 `camelCase`。
- 资源 ID 使用 UUID 字符串；已发布内容页面路由使用小写 kebab-case `slug`。
- API 时间戳使用 UTC RFC 3339，例如 `2026-08-18T09:30:00.000Z`。
- 为兼容当前页面领域模型，已发布文章 DTO 的 `publishedAt` / `updatedAt` 输出 `YYYY-MM-DD`；管理 DTO 额外输出精确时间戳 `publishedAtTime` / `updatedAtTime`。
- 可空字段稳定返回 `null`；集合稳定返回 `[]`。repository adapter 可在映射当前可选 TypeScript 字段时去掉 `null`。
- 客户端提交的未知字段返回 `422 VALIDATION_FAILED`，不静默忽略。

成功响应：

```json
{
  "data": {},
  "meta": {
    "requestId": "0191f2f4-3eca-7cce-a54f-21cd77af5931"
  }
}
```

错误响应：

```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "请求字段校验失败",
    "requestId": "0191f2f4-3eca-7cce-a54f-21cd77af5931",
    "details": [
      { "field": "title", "reason": "REQUIRED", "message": "标题不能为空" }
    ]
  }
}
```

### 2.2 身份、Cookie 与 CSRF

- 只有 `POST /auth/register` 与 `POST /auth/login` 允许匿名调用；已发布内容、`/auth/me`、`/auth/sessions/**` 和 `/me/**` 接口都要求有效 session。
- 首次注册或登录成功由服务端设置 `__Host-blog_session=<opaque-token>`，属性为 `HttpOnly; Secure; SameSite=Lax; Path=/`。本地 HTTP 开发环境可使用非 `__Host-` 开发 Cookie，生产必须使用前述配置。
- 数据库只保存 token 的 SHA-256 hash，不保存明文 token；Cookie 中的 token 只在创建或轮换时返回一次。
- 所有改变状态的请求必须同时通过 `Origin`/`Host` 同源校验；浏览器请求不能只依赖 `SameSite` 防护。
- 注册、登录和 session 轮换响应使用 `Cache-Control: no-store`；受保护接口一律 `private, no-store`。
- 客户端不能提交 `ownerId`。服务端从 session 得到唯一站长账号 ID，并在所有文章写查询中绑定该 ID。
- 注册仅用于创建数据库中唯一站长账号，不使用 setup secret、邀请码或邮件验证。账号存在后永久返回 `409 REGISTRATION_CLOSED`；系统不提供密码找回、角色或成员管理 API。

### 2.3 Cursor pagination

列表参数：

| 参数 | 默认值 | 规则 |
| --- | --- | --- |
| `limit` | `20` | 整数，范围 `1..100` |
| `cursor` | 无 | 服务端生成的 opaque base64url 字符串，不允许客户端拼装 |

分页响应：

```json
{
  "data": [],
  "pageInfo": {
    "nextCursor": "eyJ2IjoxLCJ0IjoiMjAyNi0wOC0xOFQwOTozMDowMC4wMDBaIiwiaWQiOiIuLi4ifQ",
    "hasNextPage": true
  },
  "meta": { "requestId": "0191f2f4-3eca-7cce-a54f-21cd77af5931" }
}
```

- Cursor 必须包含版本和当前排序的稳定 tie-breaker，并由服务端签名或认证；不得暴露可篡改的裸 offset。
- 文章默认按 `published_at DESC, id DESC`；站长列表按 `row_updated_at DESC, id DESC`。
- Cursor 格式错误或与当前筛选/排序不匹配时返回 `400 INVALID_CURSOR`。
- 数据在两页之间发生变化时允许出现符合 keyset pagination 语义的边界变化，但不得因相同排序值永久漏项。

### 2.4 乐观并发与幂等性

- 所有文章、站点资料写入请求必须携带当前整数 `version`。
- 更新使用 `WHERE id = $id AND owner_id = $sessionOwnerId AND version = $version`；未命中且资源仍存在时返回 `409 VERSION_CONFLICT`。
- `POST /me/posts` 必须带 `Idempotency-Key`。key 长度 `16..128`，服务端保存其 hash、请求 hash 与原响应。
- 同一账号、同一 key、同一请求重试返回首次结果；同一 key 对应不同请求返回 `409 IDEMPOTENCY_KEY_REUSED`。
- 幂等记录建议保留 24 小时；过期清理由独立维护任务处理，不放入用户请求事务。

### 2.5 Cache 与发布可见性

- 已发布内容 GET 只返回 `status = published AND deleted_at IS NULL` 的文章，但仍要求有效 session。
- 所有页面和 API 内容响应均为 `Cache-Control: private, no-store`，不得进入公共 CDN cache；草稿、归档、回收站、session 和审计同样禁止公共缓存。
- 发布、撤回发布、归档、删除、恢复后仍使相关 post、taxonomy、archive、stats 和 search cache tag 失效，避免登录后的服务端派生缓存陈旧。
- 认证内容接口不返回可被共享缓存复用的公共 `ETag`/`304`。

## 3. 核心 DTO

### 3.1 已发布内容 DTO

```ts
type LocalImageDto = {
  src: `/images/${string}`
  alt: string
  width: number
  height: number
}

type TaxonomySummaryDto = {
  slug: string
  name: string
  count: number
}

type PostSummaryDto = {
  slug: string
  title: string
  excerpt: string
  publishedAt: string       // YYYY-MM-DD
  updatedAt: string | null  // YYYY-MM-DD
  category: TaxonomySummaryDto
  tags: TaxonomySummaryDto[]
  cover: LocalImageDto
  featured: boolean
  readingMinutes: number
  wordCount: number
}

type PostDetailDto = PostSummaryDto & {
  body: ContentBlock[]
  toc: { id: string; text: string; level: 2 | 3 }[]
  previous: { slug: string; title: string } | null
  next: { slug: string; title: string } | null
}
```

`ContentBlock` 与 [`lib/content/types.ts`](../../../lib/content/types.ts) 的判别联合保持一致：

```json
[
  {
    "type": "paragraph",
    "children": [
      { "type": "text", "value": "正文" },
      { "type": "link", "value": "文档", "href": "https://example.com", "external": true },
      { "type": "code", "value": "inlineCode" }
    ]
  },
  { "type": "heading", "level": 2, "id": "starting-point", "text": "开始" },
  { "type": "list", "ordered": false, "items": ["第一项"] },
  { "type": "quote", "text": "引用", "cite": null },
  {
    "type": "image",
    "image": { "src": "/images/posts/example.svg", "alt": "示例图", "width": 1280, "height": 720 },
    "caption": null
  },
  { "type": "code", "language": "ts", "code": "const ok = true;" }
]
```

### 3.2 站长文章 DTO

```ts
type OwnerPostDto = {
  id: string
  slug: string
  title: string
  excerpt: string
  status: "draft" | "published" | "archived"
  category: { id: string; slug: string; name: string } | null
  tags: { id: string; slug: string; name: string }[]
  cover: LocalImageDto | null
  featured: boolean
  body: ContentBlock[]
  publishedAtTime: string | null
  archivedAt: string | null
  deletedAt: string | null
  createdAt: string
  updatedAtTime: string
  version: number
}
```

草稿可以暂时缺少发布必填字段，因此 `category`、`cover` 允许为 `null`，`body` 允许 `[]`；发布动作会执行完整校验。

## 4. 已发布内容读取接口（需认证）

本节所有接口都要求唯一站长的有效 session，缺少、过期、伪造或已撤销 Cookie 返回 `401 AUTHENTICATION_REQUIRED`。以下 `curl` 示例为突出查询参数而省略重复的 `Cookie: __Host-blog_session=<opaque-token>` header。

### 4.1 接口总表

| Method | Path | 成功 | repository 映射 | 排序/说明 |
| --- | --- | --- | --- | --- |
| `GET` | `/site` | `200` | `getSiteConfig` | 单例站点和作者配置 |
| `GET` | `/posts` | `200` | `getAllPosts`, `getRecentPosts` | 发布时间降序，cursor pagination |
| `GET` | `/posts/{slug}` | `200` | `getPostBySlug` | 未知或非公开文章返回 404 |
| `GET` | `/archives` | `200` | `getArchiveGroups` | 年份降序、年内文章降序 |
| `GET` | `/tags` | `200` | `getAllTags` | count 降序、name 升序 |
| `GET` | `/tags/{slug}/posts` | `200` | `getPostsByTag` | 合法空标签返回空列表 |
| `GET` | `/categories` | `200` | `getAllCategories` | count 降序、name 升序 |
| `GET` | `/categories/{slug}/posts` | `200` | `getPostsByCategory` | 合法空分类返回空列表 |
| `GET` | `/search` | `200` | `getSearchIndex` + search | 标题、taxonomy、摘要分级匹配 |
| `GET` | `/stats` | `200` | `getSiteStats` | 全部统计只基于已发布文章派生 |
| `GET` | `/sidebar` | `200` | `getSidebarData` | 组合接口，默认最近 4 篇 |

### 4.2 `GET /site`

```bash
curl -sS 'https://blog.example.com/api/v1/site'
```

```json
{
  "data": {
    "name": "棱镜手记",
    "description": "记录设计、代码与日常观察的独立博客。",
    "siteUrl": "https://blog.example.com",
    "logo": { "src": "/images/brand/logo.svg", "alt": "站点标志", "width": 96, "height": 96 },
    "author": {
      "name": "林屿",
      "role": "独立开发者",
      "bio": "作者简介",
      "avatar": { "src": "/images/brand/avatar.svg", "alt": "作者头像", "width": 240, "height": 240 },
      "links": [{ "label": "GitHub", "href": "https://github.com/" }]
    },
    "announcement": "站点公告",
    "navigation": [{ "href": "/", "label": "首页" }],
    "categories": [{ "slug": "frontend", "name": "前端札记" }],
    "tags": [{ "slug": "nextjs", "name": "Next.js" }],
    "about": {
      "greeting": "你好",
      "title": "关于作者",
      "summary": "简介",
      "skills": ["Next.js"],
      "facts": [{ "value": "6+", "label": "文章" }],
      "sections": [{ "title": "关于", "body": "正文" }]
    }
  },
  "meta": { "requestId": "0191f2f4-3eca-7cce-a54f-21cd77af5931" }
}
```

### 4.3 `GET /posts`

查询参数：`limit`、`cursor`、`featured=true|false`。不接受任意客户端排序字段。

```bash
curl -sS 'https://blog.example.com/api/v1/posts?limit=10&featured=true'
```

```json
{
  "data": [
    {
      "slug": "calm-interface-rhythm",
      "title": "为界面建立安静而稳定的节奏",
      "excerpt": "从卡片、留白和层级出发。",
      "publishedAt": "2026-07-18",
      "updatedAt": "2026-07-22",
      "category": { "slug": "design", "name": "设计观察", "count": 1 },
      "tags": [{ "slug": "css", "name": "CSS", "count": 2 }],
      "cover": { "src": "/images/posts/calm-interface.svg", "alt": "文章封面", "width": 1280, "height": 720 },
      "featured": true,
      "readingMinutes": 3,
      "wordCount": 780
    }
  ],
  "pageInfo": { "nextCursor": null, "hasNextPage": false },
  "meta": { "requestId": "0191f2f4-3eca-7cce-a54f-21cd77af5931" }
}
```

### 4.4 `GET /posts/{slug}`

```bash
curl -sS 'https://blog.example.com/api/v1/posts/calm-interface-rhythm'
```

返回 `PostDetailDto`。`toc` 从 heading blocks 派生，`previous` 指向时间线中更旧文章，`next` 指向更新文章；两端返回 `null`。

```json
{
  "data": {
    "slug": "calm-interface-rhythm",
    "title": "为界面建立安静而稳定的节奏",
    "excerpt": "从卡片、留白和层级出发。",
    "publishedAt": "2026-07-18",
    "updatedAt": "2026-07-22",
    "category": { "slug": "design", "name": "设计观察", "count": 1 },
    "tags": [],
    "cover": { "src": "/images/posts/calm-interface.svg", "alt": "文章封面", "width": 1280, "height": 720 },
    "featured": true,
    "readingMinutes": 3,
    "wordCount": 780,
    "body": [{ "type": "paragraph", "children": [{ "type": "text", "value": "正文" }] }],
    "toc": [],
    "previous": { "slug": "server-first-content", "title": "让内容从服务端自然抵达页面" },
    "next": null
  },
  "meta": { "requestId": "0191f2f4-3eca-7cce-a54f-21cd77af5931" }
}
```

不存在、草稿、归档或已删除 slug 均返回 `404 RESOURCE_NOT_FOUND`，不能泄露其非公开状态。

### 4.5 `GET /archives`

`limit` 表示本页最多文章数，而非年份数；客户端拼接分页时应合并相同年份组。

```bash
curl -sS 'https://blog.example.com/api/v1/archives?limit=20'
```

```json
{
  "data": [{ "year": 2026, "posts": [] }, { "year": 2025, "posts": [] }],
  "pageInfo": { "nextCursor": null, "hasNextPage": false },
  "meta": { "requestId": "0191f2f4-3eca-7cce-a54f-21cd77af5931" }
}
```

每个 `posts` 元素均为 `PostSummaryDto`。

### 4.6 Taxonomy 接口

```bash
curl -sS 'https://blog.example.com/api/v1/tags?limit=50'
curl -sS 'https://blog.example.com/api/v1/tags/nextjs/posts?limit=20'
curl -sS 'https://blog.example.com/api/v1/categories?limit=50'
curl -sS 'https://blog.example.com/api/v1/categories/frontend/posts?limit=20'
```

taxonomy 列表：

```json
{
  "data": [{ "slug": "nextjs", "name": "Next.js", "count": 2 }],
  "pageInfo": { "nextCursor": null, "hasNextPage": false },
  "meta": { "requestId": "0191f2f4-3eca-7cce-a54f-21cd77af5931" }
}
```

taxonomy 文章列表返回 `PostSummaryDto[]`。slug 未在 taxonomy 表中定义时返回 404；slug 合法存在但没有已发布文章时返回 `200`、`data: []`。

### 4.7 `GET /search`

参数：`q` 必填，NFKC 归一化并 trim，长度 `1..100`；另支持 `limit`、`cursor`。

```bash
curl -sS --get 'https://blog.example.com/api/v1/search' --data-urlencode 'q=Next.js' --data 'limit=20'
```

```json
{
  "data": [{
    "slug": "server-first-content",
    "title": "让内容从服务端自然抵达页面",
    "excerpt": "用小型 repository 连接结构化内容与 Server Components。",
    "category": "服务端",
    "tags": ["Next.js", "架构", "TypeScript"],
    "publishedAt": "2026-05-09"
  }],
  "pageInfo": { "nextCursor": null, "hasNextPage": false },
  "meta": { "requestId": "0191f2f4-3eca-7cce-a54f-21cd77af5931" }
}
```

排序优先级与当前实现一致：标题命中为 3，分类/标签命中为 2，摘要命中为 1；同分按 `published_at DESC, id DESC`。空查询返回 `422 VALIDATION_FAILED`，不会返回全部文章。

### 4.8 `GET /stats` 与 `GET /sidebar`

```bash
curl -sS 'https://blog.example.com/api/v1/stats'
curl -sS 'https://blog.example.com/api/v1/sidebar?recentLimit=4'
```

```json
{
  "data": { "posts": 6, "categories": 5, "tags": 10, "years": 2 },
  "meta": { "requestId": "0191f2f4-3eca-7cce-a54f-21cd77af5931" }
}
```

`sidebar` 返回 `{ site, recentPosts, categories, tags, archiveGroups, stats }`，字段分别复用本节已有 DTO；`recentLimit` 范围 `0..20`，默认 `4`。

## 5. 认证与 session 接口

### 5.1 `POST /auth/register`

首次注册不要求 Cookie、setup secret、邀请码或邮件验证，但必须通过同源 Origin 校验和独立的全站单例限速预算：

```bash
curl -i 'https://blog.example.com/api/v1/auth/register' \
  -H 'Content-Type: application/json' \
  -H 'Origin: https://blog.example.com' \
  --data '{"email":"owner@example.com","password":"correct horse battery staple","passwordConfirmation":"correct horse battery staple"}'
```

服务端严格校验 normalized email、密码规则和两次密码一致性；确认账号表为空后计算 Argon2id hash，并在一个参数化数据修改 CTE/等价短事务中创建 `owner_accounts`、`author_profiles`、缺失的 `site_settings` 与首个 `auth_sessions` 记录。成功返回 `201`、设置 session Cookie，并使用与登录相同的 account/session 响应结构。

- `passwordConfirmation` 只用于入口校验，不写入数据库或日志。
- display name 从邮箱 `@` 前缀派生；站长可在登录后通过 profile 接口修改。
- 账号已存在，或并发注册中另一请求先提交时，返回 `409 REGISTRATION_CLOSED`，不得覆盖账号、profile、site settings 或 session。
- 注册限速返回 `429 REGISTER_RATE_LIMITED` 和 `Retry-After`；注册与登录使用独立限速预算。
- 注册数据库写入不可由客户端自动重试；收到未知结果时应先尝试登录或重新读取注册状态，避免把非幂等写入盲目重放。

### 5.2 `POST /auth/login`

```bash
curl -i 'https://blog.example.com/api/v1/auth/login' \
  -H 'Content-Type: application/json' \
  -H 'Origin: https://blog.example.com' \
  --data '{"email":"owner@example.com","password":"correct horse battery staple"}'
```

请求成功返回 `200` 并设置 session Cookie：

```json
{
  "data": {
    "account": { "id": "c2a1bb63-1ccf-46bf-89cc-8df2a5246c88", "email": "owner@example.com" },
    "session": { "id": "7ec25d43-130c-4536-82ed-19f475f3c678", "expiresAt": "2026-09-17T09:30:00.000Z" }
  },
  "meta": { "requestId": "0191f2f4-3eca-7cce-a54f-21cd77af5931" }
}
```

- 邮箱统一 trim + lowercase 后查询。
- 无账号、密码错误和账号不可用统一返回 `401 INVALID_CREDENTIALS`。
- 限速触发返回 `429 LOGIN_RATE_LIMITED` 和 `Retry-After`，不得泄露账号是否存在。
- 密码校验使用 Argon2id（具体参数在实现时按部署环境基准测试固化），不得使用可逆加密或通用 SHA hash 代替 password hashing。

### 5.3 Session 操作

| Method | Path | 行为 | 成功状态 |
| --- | --- | --- | --- |
| `POST` | `/auth/refresh` | 轮换当前 opaque token，旧 token 立即失效 | `200` |
| `POST` | `/auth/logout` | 撤销当前 session 并清除 Cookie | `204` |
| `GET` | `/auth/me` | 返回当前账号与当前 session | `200` |
| `GET` | `/auth/sessions` | 返回全部未过期 session，不返回 token/hash | `200` |
| `DELETE` | `/auth/sessions/{sessionId}` | 撤销指定 session；可撤销当前 session | `204` |
| `DELETE` | `/auth/sessions` | 撤销全部 session 并清除当前 Cookie | `204` |

刷新示例：

```bash
curl -i -X POST 'https://blog.example.com/api/v1/auth/refresh' \
  -H 'Origin: https://blog.example.com' \
  -H 'Cookie: __Host-blog_session=<opaque-token>'
```

session 列表响应：

```json
{
  "data": [{
    "id": "7ec25d43-130c-4536-82ed-19f475f3c678",
    "createdAt": "2026-08-18T09:30:00.000Z",
    "lastSeenAt": "2026-08-18T10:00:00.000Z",
    "expiresAt": "2026-09-17T09:30:00.000Z",
    "current": true
  }],
  "meta": { "requestId": "0191f2f4-3eca-7cce-a54f-21cd77af5931" }
}
```

除 logout 可在无有效 session 时幂等清除浏览器 Cookie 外，上述 session 接口都要求有效的唯一站长 session。所有受保护接口缺少、过期或已撤销 Cookie 时统一返回：

```json
{
  "error": {
    "code": "AUTHENTICATION_REQUIRED",
    "message": "请先登录",
    "requestId": "0191f2f4-3eca-7cce-a54f-21cd77af5931"
  }
}
```

## 6. 站长资料接口

| Method | Path | 身份 | 成功 | 请求/说明 |
| --- | --- | --- | --- | --- |
| `GET` | `/me/profile` | 唯一站长 session | `200` | 获取公开作者资料、about 和 `version` |
| `PATCH` | `/me/profile` | 唯一站长 session + 同源 Origin | `200` | 可编辑字段 + `version`；不修改登录邮箱/密码 |

```bash
curl -sS -X PATCH 'https://blog.example.com/api/v1/me/profile' \
  -H 'Content-Type: application/json' \
  -H 'Origin: https://blog.example.com' \
  -H 'Cookie: __Host-blog_session=<opaque-token>' \
  --data '{"name":"林屿","bio":"新的简介","version":3}'
```

成功返回更新后的 profile；版本过期返回 `409 VERSION_CONFLICT`。头像和链接沿用 `LocalImageDto` 与 `{label, href}`，只接受 `https:`、`mailto:` 或站内绝对路径。

## 7. 站长文章 CRUD 与工作流

### 7.1 状态机

| 当前状态 | Action | 目标状态 | 关键行为 |
| --- | --- | --- | --- |
| 无 | create | `draft` | 创建草稿；`owner_id` 来自 session |
| `draft` | publish | `published` | 完整校验；首次发布写入 `published_at` |
| `published` | withdraw | `draft` | 立即下线；保留首次 `published_at` |
| `draft` / `published` | archive | `archived` | 下线并写入 `archived_at` |
| `archived` | unarchive | `draft` | 清除 `archived_at`，不会自动发布 |
| 任意未删除状态 | delete | `draft` + deleted | 软删除并转草稿，避免恢复后意外公开 |
| deleted | restore | `draft` | 清除 `deleted_at`，必须再次显式发布 |

- `PATCH` 不能修改 `status`、`publishedAtTime`、`archivedAt`、`deletedAt`、`ownerId` 或 `version`。
- 已首次发布的文章 slug 永久锁定；修改返回 `409 SLUG_IMMUTABLE`。
- 归档、撤回、删除均同步失效相关服务端派生缓存；已发布内容查询以数据库状态为最终判断，不能让非发布文章继续返回。

### 7.2 接口总表

| Method | Path | 身份 | 成功 | 行为 |
| --- | --- | --- | --- | --- |
| `POST` | `/me/posts` | 唯一站长 session + 同源 Origin | `201` | 创建草稿，要求 `Idempotency-Key` |
| `GET` | `/me/posts` | 唯一站长 session | `200` | 站长文章列表，可筛选状态和回收站 |
| `GET` | `/me/posts/{id}` | 唯一站长 session | `200` | 获取单篇站长文章 |
| `PATCH` | `/me/posts/{id}` | 唯一站长 session + 同源 Origin | `200` | 编辑内容，要求 `version` |
| `DELETE` | `/me/posts/{id}` | 唯一站长 session + 同源 Origin | `200` | 软删除，body 要求 `version` |
| `POST` | `/me/posts/{id}/restore` | 唯一站长 session + 同源 Origin | `200` | 恢复为草稿 |
| `POST` | `/me/posts/{id}/publish` | 唯一站长 session + 同源 Origin | `200` | 发布 |
| `POST` | `/me/posts/{id}/withdraw` | 唯一站长 session + 同源 Origin | `200` | 撤回发布 |
| `POST` | `/me/posts/{id}/archive` | 唯一站长 session + 同源 Origin | `200` | 归档 |
| `POST` | `/me/posts/{id}/unarchive` | 唯一站长 session + 同源 Origin | `200` | 撤销归档为草稿 |

因为系统只有一个账号，API 不提供 `/users/{userId}/posts`、admin 或跨账号操作入口。

### 7.3 创建草稿

```bash
curl -sS -X POST 'https://blog.example.com/api/v1/me/posts' \
  -H 'Content-Type: application/json' \
  -H 'Origin: https://blog.example.com' \
  -H 'Idempotency-Key: 5f766a70-94d9-4ffc-92ab-87bcf3bf5899' \
  -H 'Cookie: __Host-blog_session=<opaque-token>' \
  --data '{"title":"新的文章草稿"}'
```

返回 `201`、`Location: /api/v1/me/posts/{id}` 和完整 `OwnerPostDto`。草稿创建只要求非空 `title`；未提供的可选内容使用 `null`、`[]` 或 `false`。

### 7.4 列表与详情

```bash
curl -sS 'https://blog.example.com/api/v1/me/posts?status=draft&deleted=false&limit=20' \
  -H 'Cookie: __Host-blog_session=<opaque-token>'
```

参数：

| 参数 | 规则 |
| --- | --- |
| `status` | 可重复：`draft`、`published`、`archived`；默认全部 |
| `deleted` | `false` 默认，`true` 只看回收站，`all` 查看全部 |
| `q` | 可选，匹配 title/slug，长度 `1..100` |
| `limit` / `cursor` | 使用全局 cursor 规则 |

不存在或不属于 session owner 的 ID 统一返回 `404 RESOURCE_NOT_FOUND`。即使当前是单账号，也必须在 SQL 中带 `owner_id` 条件。

### 7.5 编辑

```bash
curl -sS -X PATCH 'https://blog.example.com/api/v1/me/posts/92c5195c-12c6-41f0-9763-a3e2471352ab' \
  -H 'Content-Type: application/json' \
  -H 'Origin: https://blog.example.com' \
  -H 'Cookie: __Host-blog_session=<opaque-token>' \
  --data '{
    "title":"更新后的标题",
    "excerpt":"更新后的摘要",
    "slug":"new-post",
    "categoryId":"80472e73-7e18-4993-9e65-c2c0c9aac95f",
    "tagIds":["7d97ea53-e638-440f-9911-c2ec8dab9222"],
    "cover":{"src":"/images/posts/new-post.svg","alt":"文章封面","width":1280,"height":720},
    "featured":false,
    "body":[{"type":"paragraph","children":[{"type":"text","value":"正文"}]}],
    "version":1
  }'
```

更新文章与替换标签关系必须在同一短事务内完成，并写入一条 audit event。空 PATCH 返回 `422 VALIDATION_FAILED`。

### 7.6 发布

```bash
curl -sS -X POST 'https://blog.example.com/api/v1/me/posts/92c5195c-12c6-41f0-9763-a3e2471352ab/publish' \
  -H 'Content-Type: application/json' \
  -H 'Origin: https://blog.example.com' \
  -H 'Cookie: __Host-blog_session=<opaque-token>' \
  --data '{"version":2}'
```

发布前必须校验：

- `title`、`excerpt`、合法且唯一的 `slug`；
- 有效 category、至少一个有效 tag；
- 非空且通过完整判别联合校验的 `body`；heading ID 在文章内唯一；
- 完整 cover：站内 `/images/` 路径、非空 alt、正整数 width/height；
- 首次发布由服务端时钟写入 `published_at`，不接受未来时间，不实现定时发布。

失败示例：

```json
{
  "error": {
    "code": "PUBLISH_VALIDATION_FAILED",
    "message": "文章尚未满足发布条件",
    "requestId": "0191f2f4-3eca-7cce-a54f-21cd77af5931",
    "details": [
      { "field": "cover.alt", "reason": "REQUIRED", "message": "封面替代文本不能为空" },
      { "field": "tagIds", "reason": "MIN_ITEMS", "message": "至少选择一个标签" }
    ]
  }
}
```

### 7.7 其他状态动作

所有 action body 均为 `{ "version": <integer> }`：

```bash
curl -sS -X POST 'https://blog.example.com/api/v1/me/posts/<id>/withdraw' -H 'Content-Type: application/json' -H 'Origin: https://blog.example.com' -H 'Cookie: __Host-blog_session=<opaque-token>' --data '{"version":3}'
curl -sS -X POST 'https://blog.example.com/api/v1/me/posts/<id>/archive' -H 'Content-Type: application/json' -H 'Origin: https://blog.example.com' -H 'Cookie: __Host-blog_session=<opaque-token>' --data '{"version":4}'
curl -sS -X POST 'https://blog.example.com/api/v1/me/posts/<id>/unarchive' -H 'Content-Type: application/json' -H 'Origin: https://blog.example.com' -H 'Cookie: __Host-blog_session=<opaque-token>' --data '{"version":5}'
curl -sS -X POST 'https://blog.example.com/api/v1/me/posts/<id>/restore' -H 'Content-Type: application/json' -H 'Origin: https://blog.example.com' -H 'Cookie: __Host-blog_session=<opaque-token>' --data '{"version":7}'
```

软删除因 HTTP `DELETE` 仍携带 JSON body：

```bash
curl -sS -X DELETE 'https://blog.example.com/api/v1/me/posts/<id>' \
  -H 'Content-Type: application/json' \
  -H 'Origin: https://blog.example.com' \
  -H 'Cookie: __Host-blog_session=<opaque-token>' \
  --data '{"version":6}'
```

合法 action 成功返回更新后的 `OwnerPostDto`。状态不允许时返回 `409 INVALID_STATE_TRANSITION`；重复删除返回相同错误，恢复未删除文章亦返回冲突。

## 8. 审计读取接口

`GET /me/audit-events?postId=<uuid>&action=publish&limit=50&cursor=...` 要求唯一站长 session，成功返回 `200`。

只允许唯一站长读取；响应按 `occurred_at DESC, id DESC`，不返回 password、session token/hash、Cookie 或请求正文。

```json
{
  "data": [{
    "id": "aa40567d-ae4c-438a-b8de-a78265f289f2",
    "postId": "92c5195c-12c6-41f0-9763-a3e2471352ab",
    "action": "publish",
    "requestId": "0191f2f4-3eca-7cce-a54f-21cd77af5931",
    "changes": { "fromStatus": "draft", "toStatus": "published", "fromVersion": 2, "toVersion": 3 },
    "occurredAt": "2026-08-18T09:30:00.000Z"
  }],
  "pageInfo": { "nextCursor": null, "hasNextPage": false },
  "meta": { "requestId": "0191f2f4-3eca-7cce-a54f-21cd77af5931" }
}
```

## 9. 状态码与稳定错误 code

| HTTP | Code | 场景 |
| --- | --- | --- |
| `400` | `INVALID_JSON` | JSON 无法解析 |
| `400` | `INVALID_CURSOR` | Cursor 格式、签名或筛选上下文错误 |
| `401` | `AUTHENTICATION_REQUIRED` | 缺少、过期或已撤销 session |
| `401` | `INVALID_CREDENTIALS` | 登录凭据无效，统一响应 |
| `403` | `ORIGIN_NOT_ALLOWED` | 写请求未通过同源校验 |
| `404` | `RESOURCE_NOT_FOUND` | 资源不存在、非公开或不属于当前 owner |
| `405` | `METHOD_NOT_ALLOWED` | 路径存在但 HTTP method 不受支持 |
| `409` | `REGISTRATION_CLOSED` | 唯一账号已存在或并发首次注册失败 |
| `409` | `VERSION_CONFLICT` | 乐观并发版本冲突 |
| `409` | `SLUG_CONFLICT` | slug 已存在 |
| `409` | `SLUG_IMMUTABLE` | 已首次发布文章尝试修改 slug |
| `409` | `INVALID_STATE_TRANSITION` | 当前状态不允许 action |
| `409` | `IDEMPOTENCY_KEY_REUSED` | 同一 key 对应不同请求 |
| `422` | `VALIDATION_FAILED` | 一般字段错误 |
| `422` | `PUBLISH_VALIDATION_FAILED` | 发布完整性校验失败 |
| `429` | `LOGIN_RATE_LIMITED` | 登录限速，携带 `Retry-After` |
| `429` | `REGISTER_RATE_LIMITED` | 首次注册限速，携带 `Retry-After` |
| `503` | `DATABASE_UNAVAILABLE` | Neon 暂时不可用；响应不得包含连接串 |
| `500` | `INTERNAL_ERROR` | 未分类错误；只向客户端返回 request ID |

数据库 unique/check/FK 错误必须在 repository/service 层映射为以上稳定 code，不能直接把 PostgreSQL message、表名或 SQL 返回给客户端。

## 10. 重试边界

- 客户端可有限重试幂等 GET；遇到 `429` 尊重 `Retry-After`，遇到 `503` 使用抖动退避。首次注册不是幂等重试接口。
- 服务端仅自动重试尚未向客户端提交响应的幂等读取，或有 `Idempotency-Key` 且能够读取首次结果的创建请求。
- `PATCH`、发布、撤回、归档、删除、恢复和 session 轮换默认不自动重试；调用方应重新读取资源并根据 `version` 决定。
- PostgreSQL serialization/deadlock 重试必须重放整个短事务，最多有限次数；不能只重跑事务中的最后一条 SQL。

## 11. 当前领域模型映射

| 当前类型/查询 | API 来源 | 数据库事实/派生 |
| --- | --- | --- |
| `SiteConfig` | `GET /site` | `site_settings` + `author_profiles` + taxonomy definitions |
| `PostSummary` | `GET /posts` | `posts` + category/tags；word count/read time派生 |
| `PostDetail` | `GET /posts/{slug}` | summary + `body`；toc 与前后篇派生 |
| `TaxonomySummary` | `GET /tags`, `/categories` | definition + 已发布文章 count |
| `ArchiveYearGroup` | `GET /archives` | `published_at` 年份分组 |
| `SearchDocument` | `GET /search` | 已发布文章 title/excerpt/category/tag 投影 |
| `SiteStats` | `GET /stats` | 已发布文章、非空 taxonomy、年份 count |
| `SidebarData` | `GET /sidebar` | 上述已发布内容 DTO 的组合结果 |

已发布内容 DTO adapter 必须保持 [`lib/content/repository.ts`](../../../lib/content/repository.ts) 的排序和未知/空 taxonomy 语义，页面不直接依赖数据库行结构。
