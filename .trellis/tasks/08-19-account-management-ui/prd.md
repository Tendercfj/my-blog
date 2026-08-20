# 账号管理 UI PRD

## 目标

把现有 `/account` 占位页补成唯一站长可使用的管理工作区，覆盖站点/作者资料、session 安全、文章导航、筛选和回收站。

## 页面范围

- `/account`：账号、统计、最近文章、草稿数量和快捷入口。
- `/account/profile`：站点设置、作者资料、头像、链接和 about 编辑。
- `/account/security`：当前/其他 session 列表、单个撤销、全部退出。
- `/account/posts`：文章搜索、状态筛选、cursor pagination、回收站、新建和编辑入口。

## 需求

- 页面初始数据由 Server Components 直接调用 service；交互表单通过 `/api/v1`。
- 使用共享 browser API client 解码 envelope/error，不在组件中重复 cast。
- 所有表单展示 pending、success、field/general error 和 request ID。
- profile/site 保存使用 `version`，冲突不静默覆盖。
- session 撤销与全部退出使用确认；当前 session 失效后进入 `/login`。
- 文章列表区分 draft/published/archived/deleted，支持空状态和 cursor。
- 复用现有 glass-card、Button、布局、focus 和移动断点。

## 验收标准

- [ ] AC1：工作台数据与 repository 统计一致，所有快捷入口有效。
- [ ] AC2：站点、作者和 about 可保存，字段错误可定位，版本冲突保留表单内容。
- [ ] AC3：头像上传成功后可预览，只有保存资料才更新 profile。
- [ ] AC4：session 列表标记当前项；撤销行为和 Cookie/跳转正确。
- [ ] AC5：文章列表筛选、搜索、分页、空状态和回收站正确。
- [ ] AC6：键盘、focus、确认 Dialog、loading/error 在桌面和 390px 可用。
- [ ] AC7：test、lint、typecheck、build 与浏览器验证通过。

## 不在范围

- 不实现正文编辑器、文章状态动作、独立 taxonomy 或审计页面。

## 依赖

- `08-19-owner-write-api` 必须完成；文章列表依赖其 owner list endpoint。
