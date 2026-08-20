# 账号管理 UI 设计

## Server/Client 边界

- route page 保持 Server Component，权威 session 与初始 DTO 在服务端读取。
- profile/security/list 的交互区是小型 Client Components。
- Client Components 只导入 browser API client、共享 DTO schemas 和纯 UI；禁止导入 server-only repository。

## 组件边界

- `components/account/account-nav.tsx`：管理页导航与 active state。
- `components/account/dashboard-*`：纯展示卡片。
- `components/account/profile-form.tsx`：site/profile 两个版本快照和显式保存。
- `components/account/session-list.tsx`：撤销操作。
- `components/account/post-list.tsx`：filter/search/page controls 和行操作入口。
- `lib/api/client.ts`：从 `unknown` 解码 success/error，携带 request ID。

管理 route 使用已有 protected layout；不复制站点 shell。列表筛选写入 URL search params，支持刷新/分享并由 Server Component 读取。

## 回滚

每个管理路由独立；移除某个 UI 不改变 API 或数据库。现有 `/account` 的退出能力在工作台替换过程中保持可用。
