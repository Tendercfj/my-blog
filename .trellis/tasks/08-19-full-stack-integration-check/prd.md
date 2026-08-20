# 全栈集成验收 PRD

## 目标

对父任务所有页面、接口、数据库边界和管理工作流进行最终集成验证，修复真实缺口，并形成可复核的完成证据。

## 需求

- 核对父任务与前 5 个子任务的全部 AC、接口和页面映射。
- 完成 local adapter 离线全链路；真实/隔离 Neon 只在用户另行批准后验证。
- 覆盖认证、读取、写入、状态机、并发、导入、错误、安全和回滚边界。
- 浏览器验证全部展示和管理路由的桌面/平板/移动、键盘、focus、loading/error/empty。
- 检查无自动 fallback、无内部 HTTP、无未认证内容、无 Secret/SQL 泄露。
- 运行 test、lint、typecheck、build 和 Trellis check。
- 更新实施文档和必要的项目 spec；不在本任务引入新产品功能。

## 验收标准

- [ ] AC1：父任务 AC1–AC15 均有测试、命令、数据库或浏览器证据。
- [ ] AC2：所有文档列出的 `/api/v1` endpoints 存在且行为一致，没有孤立 UI 或无入口 API。
- [ ] AC3：所有展示和管理路由可直接访问/刷新，未知/empty/error 状态正确。
- [ ] AC4：完整文章工作流和 session 工作流通过，version/idempotency/rollback 得到验证。
- [ ] AC5：`1440×900`、`1024×768`、`390×844` 无水平溢出或关键交互不可用。
- [ ] AC6：匿名、伪造、过期、撤销 session 不能读取业务页面/API 或执行写操作。
- [ ] AC7：代码/日志/响应不泄露 password、token/hash、Cookie、数据库 URL、SQL 或正文审计内容。
- [ ] AC8：`pnpm test`、lint、typecheck、build 和 `trellis-check` 通过。
- [ ] AC9：未获批准的真实 Neon/生产验证明确标记未执行，不伪造结果。

## 不在范围

- 不新增功能、远程资源、部署、CI/CD 或生产操作。

## 依赖

- 前 5 个子任务全部完成。
