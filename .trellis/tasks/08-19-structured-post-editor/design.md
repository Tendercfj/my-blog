# 结构化文章编辑器设计

## 状态模型

```text
serverSnapshot (OwnerPostDto)
        │
        ├─ initialize/reset ──> editorDraft
        │                        │
        │                        ├─ normalize + deep compare ──> dirty
        │                        ├─ validate client hints
        │                        └─ PATCH(version)
        │                                  │
        ├<──────── success DTO ────────────┤
        └─ unchanged on 409 <──────────────┘
```

一个 reducer 按 action 更新 editor state；block 操作不散落多个局部 state。服务器 schema 是最终验证，客户端 schema 用于即时反馈和安全解码。

## 组件

- `post-editor.tsx`：reducer、save/action orchestration、dirty/conflict。
- `post-metadata-fields.tsx`：metadata/taxonomy/cover。
- `block-editor.tsx` + type-specific editors：穷尽 ContentBlock。
- `post-preview.tsx`：复用从 `PostBody` 抽出的纯 block renderer。
- `post-status-actions.tsx`：状态与 confirm dialogs。
- `post-audit-list.tsx`：文章最近事件。
- `unsaved-changes-guard.tsx`：beforeunload 与编辑页导航守卫。

## 离开与冲突

- refresh/close 使用 native `beforeunload`。
- 页面内 Link、返回、保存后跳转和状态动作后的跳转使用同一个 confirm guard。
- 409 保留 editorDraft 和原 serverSnapshot，记录最新服务器 version/时间提示。
- 不提供隐式 force overwrite；用户先导出本地 JSON，或明确放弃并重新读取。

## Preview

renderer 接受经过 schema 校验的 blocks，不依赖数据库或 server-only 模块。编辑器预览不伪造 published state；只展示正文和元数据草稿效果。

## 回滚

编辑器路由可以移除而不改变 owner APIs；所有未保存状态只在浏览器内，不写 localStorage 或数据库隐式草稿。
