---
doc_type: implementation-guide
slug: bridge-rule-separation-next-steps
pitch: 发送、响应、匹配三标签规则工作区已完成落地，记录本轮实现结果与当前边界
status: completed
created_at: 2026-06-26
completed_at: 2026-06-26
parent_requirement: bridge-rule-separation
tags:
  - bridge
  - panel
  - ui
  - implementation
---

# 桥接规则分离 - 实现落地记录

原“下一步实现”中的核心目标已完成，本文件改作本轮实现回顾，避免后续把已落地能力误判成待开发项。

## 已完成（2026-06-26）

### 1. 数据层与存储层重构
- `BridgeSender` 模型：一个发送对应多个响应候选，`activeResponseId` 指向当前生效响应
- `BridgeResponseOption` 模型：独立的响应实体，可独立编辑、触发、切换
- 自动迁移逻辑：从旧 `BridgeMockRule[]` 迁移到 `BridgeSender[]`
- 存储层适配：`storage.ts` 读写新格式，启动时自动迁移，并通过 `normalizeSenders` 保持数据一致性

### 2. 状态层与命令层重构
- `AppViewState` 扩展：新增 `selectedSenderId`、`senderDraft`、`selectedResponse`、`responseDraft`
- `usePanelController` 重写：所有命令和草稿逻辑切换到 sender/response 模型
- 同步逻辑：`syncSnapshotState` 处理 sender/response 草稿的脏检测和同步
- 新增命令：`UPSERT_SENDER`、`DELETE_SENDER`、`DUPLICATE_SENDER`、`TOGGLE_SENDER`
- 新增命令：`UPSERT_RESPONSE`、`DELETE_RESPONSE`、`SET_ACTIVE_RESPONSE`、`TRIGGER_RESPONSE`
- `BridgeMatcher` 适配：匹配时查找 sender 的活跃响应

### 3. 规则面板工作区重构
- 规则页已拆成 `发送`、`响应`、`匹配` 三个子页签，由 `RuleWorkspace` 统一承载
- 旧 `RuleEditor`、`RulesList` 已移除，替换为 `SendersView`、`ResponsesView`、`MatchesView` 等拆分组件
- `senderActions`、`responseActions`、`panelActions`、`actionContext` 已拆出，避免面板控制器继续膨胀
- `controllerFilters` 统一处理发送、响应、匹配视图的筛选结果

### 4. 预览模式与样式拆分
- 新增 `previewRuntime`、`previewScenarios` 和 `preview-panel.html`，便于在开发态预览规则面板
- `styles.css` 已拆成基础、工作区、卡片、控件、Toast 等 CSS 模块

## 对照最初目标

- 三子页签 UI：已完成
- 活跃响应切换：已完成
- 独立响应编辑与手动触发：已完成
- 发送 / 响应 / 配对关系分层查看：已完成

## 验证结果

- `npm run typecheck` 通过
- `npm run build` 通过

## 当前边界

1. 当前关联仍围绕桥接事件名工作，不按 `requestId`、`callbackId` 等实例级字段做精确关联。
2. 一个发送桥接可挂多个响应候选，但同一时刻只允许一个活跃响应。
3. “关闭配对”只会关闭自动响应；手动触发响应仍然可用。
4. 这轮实现聚焦规则模型与规则页工作区，不改变桥接拦截、日志记录和页面回放的基础机制。

## 本轮新增的实现项

- `RuleWorkspace`：统一管理规则页子页签布局
- `SendersView` / `ResponsesView` / `MatchesView`：发送、响应、匹配三视图分治
- `senderActions` / `responseActions` / `panelActions`：将操作逻辑从 `usePanelController` 拆出
- `actionContext`：统一封装面板命令、状态更新和 Toast 上下文
- `previewRuntime` / `previewScenarios`：支持开发预览模式

**状态**：本文件对应的“下一步实现”已完成，不再作为待开发清单使用。
