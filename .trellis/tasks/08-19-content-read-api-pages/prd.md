# 内容读取接口与展示页 PRD

## 目标

实现全部受保护内容读取 API，并将现有 8 个博客展示页切换到统一 application service/repository，同时保持视觉、URL、metadata 和空状态行为。

## 需求

- 实现 site、posts、post detail、archives、tags、tag posts、categories、category posts、search、stats、sidebar Route Handlers。
- 所有接口独立校验 session，解析 query/cursor，使用统一 envelope、request ID、稳定错误 code 和 `private, no-store`。
- Server Components 直接调用 service/repository，不通过内部 HTTP。
- 逐页迁移 `/`、`/archives`、tags、categories、`/about` 和 post detail。
- runtime 新 slug 无需 rebuild 即可访问；未知 slug 404，合法空 taxonomy 为 200 空列表。
- metadata、search、sidebar、stats 与已发布事实一致。

## 验收标准

- [ ] AC1：全部读取 endpoints 具有 method、auth、query、success/error contract tests。
- [ ] AC2：无 session 返回 JSON 401，不发生 HTML redirect。
- [ ] AC3：8 个页面不直接导入 `content/site.ts` 或 `content/posts.ts`。
- [ ] AC4：页面与 API 对排序、DTO、404/empty 和计数的结果一致。
- [ ] AC5：新发布 slug 的 runtime 路由不依赖 `generateStaticParams` 完整枚举。
- [ ] AC6：桌面、平板、390px 移动端视觉与交互没有数据源切换退化。
- [ ] AC7：test、lint、typecheck、build 和浏览器逐页验证通过。

## 不在范围

- 不实现站长写接口、管理页或编辑器。
- 不连接真实 Neon；使用 local adapter 和可注入 repository fixtures 验证。

## 依赖

- 必须在 `08-19-database-content-foundation` 通过后开始。
