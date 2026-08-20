# 全栈集成验收设计

## 验证矩阵

| 维度 | 重点 |
| --- | --- |
| 数据 | local/Neon contract、import preflight/atomicity、404 vs empty |
| 认证 | register/login/refresh/logout/session revoke/protected page/API |
| 读取 | site/posts/archive/taxonomy/search/stats/sidebar 与页面一致 |
| 写入 | site/profile/taxonomy/post CRUD/actions/audit |
| 并发 | version conflict、idempotency key、状态竞争 |
| UI | dashboard/settings/security/list/editor/preview/actions |
| 安全 | origin、owner、parameterization、error cleaning、Secret scan |
| 质量 | test/lint/typecheck/build/browser/Trellis check |

## 环境分层

- 必做：local adapter + repository/Route Handler tests + browser fixtures。
- 条件必做：若存在 disposable local PostgreSQL，执行 SQL contract tests。
- 需再次批准：隔离 Neon migration/import/integration。
- 禁止：production migration、真实凭据输出、远程 destructive cleanup。

## 缺陷处理

发现缺陷时定位到拥有它的子任务层；做最小修复并重跑该层专项与最终回归。若发现需求/设计变化，回滚规划而不是在验收阶段悄悄扩张。
