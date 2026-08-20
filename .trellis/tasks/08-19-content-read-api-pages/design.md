# 内容读取接口与展示页设计

## 边界

本子任务实现父设计第 6.1、7.1、8 节。Route Handler 只做 HTTP adapter，页面直接调用同一 service。

## 路由映射

| 页面 | service 能力 | API |
| --- | --- | --- |
| `/` | posts + sidebar | `/posts`, `/sidebar` |
| `/archives` | archives + sidebar | `/archives`, `/sidebar` |
| `/tags` | tags | `/tags` |
| `/tags/[slug]` | tag posts + sidebar | `/tags/[slug]/posts` |
| `/categories` | categories | `/categories` |
| `/categories/[slug]` | category posts + sidebar | `/categories/[slug]/posts` |
| `/about` | site/profile | `/site` |
| `/posts/[slug]` | post detail + sidebar | `/posts/[slug]`, `/sidebar` |

## 共享边界

- 共享 query/cursor schemas、session guard 和 error response，不复制 payload casts。
- Route Handler `GET` 默认动态/no-store，不启用公共 Cache Components。
- 页面 metadata 与 page body 通过 request-scoped memoized service 共享读取。
- 动态详情页移除 `dynamicParams = false`；`generateStaticParams` 不是正确性的来源。

## 回滚

Route Handlers 可独立移除而不影响 Server Components；页面迁移逐页提交，开发验证可显式选择 local adapter。
