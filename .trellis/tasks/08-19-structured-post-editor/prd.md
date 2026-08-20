# 结构化文章编辑器 PRD

## 目标

让唯一站长能够仅通过 UI 完成文章从新建草稿到编辑、预览、发布、撤回、归档、删除和恢复的完整工作流。

## 页面范围

- `/account/posts/new`：使用幂等 key 创建最小草稿并进入编辑页。
- `/account/posts/[id]/edit`：元数据、ContentBlock、预览、保存、状态动作与最近审计。

## 需求

- 元数据覆盖 title、slug、excerpt、category、tags、featured、cover。
- taxonomy 可选择或就地创建；不建设独立 taxonomy 页。
- 编辑全部 block：heading、paragraph/inline text-link-code、list、quote、image、code。
- 每个 block 支持新增、编辑、上移、下移、复制、删除；不用拖拽或 Markdown。
- 预览复用现有 block renderer，桌面可并列/切换，移动端 tabs 切换。
- 图片复用现有 R2 上传；上传与保存的错误状态分开。
- 只手动保存；显示 saving/saved/error/conflict，未保存离开会警告。
- dirty 由规范化当前值和服务器快照比较。
- version conflict 保留本地内容，不自动覆盖、重试或丢弃。
- 支持导出/复制本地结构化草稿后再选择重新加载服务器版本。
- 状态 action 使用确认 Dialog；发布字段错误映射到字段或 block。
- 编辑页显示该文章最近审计事件，不新增审计中心。

## 验收标准

- [ ] AC1：重复 new 请求不会创建重复草稿。
- [ ] AC2：全部 block 类型能创建、编辑、排序、复制、删除并正确预览/保存/重新读取。
- [ ] AC3：封面和正文图片上传成功/失败均有明确反馈，保存失败不丢本地 URL。
- [ ] AC4：手动保存成功更新 version；未保存状态与离开提示准确。
- [ ] AC5：双窗口制造 version conflict 时后写不会覆盖先写，本地草稿仍可导出。
- [ ] AC6：publish/withdraw/archive/unarchive/delete/restore UI 与状态机一致，非法动作不可用或显示稳定错误。
- [ ] AC7：发布校验可定位到 title、slug、excerpt、category、tags、cover 或正文块。
- [ ] AC8：最近审计记录与成功操作一致且不显示正文/Secret。
- [ ] AC9：键盘、focus、按钮名称和 `390px` 移动体验可用，无水平溢出。
- [ ] AC10：test、lint、typecheck、build 和浏览器闭环通过。

## 不在范围

- 自动保存、拖拽、Markdown、任意 HTML、多人协作、定时发布和媒体库管理。

## 依赖

- `08-19-owner-write-api` 与 `08-19-account-management-ui` 必须完成。
