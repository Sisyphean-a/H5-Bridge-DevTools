---
doc_type: feature-design-review
feature: 2026-06-28-panel-global-navigation-history
status: passed
reviewed: 2026-06-28
round: 1
---

# panel-global-navigation-history feature design 审查报告

## 1. Scope And Inputs

- Design: `.codestable/features/2026-06-28-panel-global-navigation-history/panel-global-navigation-history-design.md`
- Checklist: `.codestable/features/2026-06-28-panel-global-navigation-history/panel-global-navigation-history-checklist.yaml`
- Intent / brainstorm: none
- Roadmap: none
- Related docs:
  - `.codestable/requirements/bridge-rule-separation.md`
  - `.codestable/reference/shared-conventions.md`
  - `.codestable/reference/code-dimensions.md`
  - `.codestable/compound/2026-06-26-match-flow-without-sender-toggle.md`
  - `.codestable/compound/2026-06-25-explore-bridge-response-correlation.md`
- Code facts checked:
  - `src/panel/types.ts`
  - `src/panel/App.tsx`
  - `src/panel/usePanelController.ts`
  - `src/panel/helpers.ts`
  - `src/panel/selectionState.ts`
  - `src/panel/senderActions.ts`
  - `src/panel/responseActions.ts`
  - `src/panel/components/RuleWorkspace.tsx`
  - `src/panel/components/LogsPanel.tsx`
  - `src/panel/components/rules/MatchesView.tsx`
  - `src/panel/components/rules/SenderDetailPane.tsx`
  - `src/panel/components/rules/ResponsesView.tsx`

### Independent Review

- Status: local-only
- Detection: local-review-with-agent-cli-available
- Provider / agent: none
- Raw output: 检测到 `claude` / `opencode` CLI，但根据 `cs-feat-design-review` 规则，本轮未自动调用外部 CLI；Paseo health check 超时，且无 orchestration preferences
- Merge policy: 本轮仅做本地事实核验 review，无外部 reviewer 输出待合并
- Gate effect: none

## 2. Design Summary

- Goal: 为 panel 增加统一路由历史，让鼠标侧键可以按真实跳转来源回退，而不是继续依赖零散的 `narrowDetailOpen=false`
- Key contracts:
  - 名词层：新增 `PanelRoute` / `PanelNavigationState`，把 tab、rules subtab、详情目标统一建模
  - 编排层：所有切页入口统一走 `push / replace / back`，并在 snapshot/delete 后做 route normalize
- Steps: 5 步，先做纯状态微重构，再接顶层/子页签、跨页动作、失效回退、全局侧键
- Checks: 8 条，来源覆盖范围守护、名词契约、编排约束、挂载点、验收场景
- Baseline / validation: 预检 `npm run typecheck`、`npm run test`，交付前 `npm run build`，并要求真实 DevTools panel 手工验证跨页回退

## 3. Findings

### blocking

- none

### important

- none

### nit

- none

### suggestion

- none

### learning

- 当前 panel 的导航问题不是“缺一个侧键监听”，而是“缺统一可回放的路由抽象”；这份 design 先补抽象再补输入事件，顺序正确

### praise

- design 在 `.codestable/features/2026-06-28-panel-global-navigation-history/panel-global-navigation-history-design.md:54-57` 明确写了“失效路由降级顺序”，把删除 sender/response 后的回退行为前置成契约，而不是把异常留到实现阶段临场处理
- checklist 第 1 步把导航模块抽取单独列成“只搬不改行为”的微重构，和 `usePanelController.ts` 当前体量、职责现状是对齐的

## 4. User Review Focus

- 用户需要重点拍板：
  - `.codestable/features/2026-06-28-panel-global-navigation-history/panel-global-navigation-history-design.md:270-272` 的假设是否成立，也就是宽屏下侧键返回是否接受“回来源页/列表页”的统一语义
  - `.codestable/features/2026-06-28-panel-global-navigation-history/panel-global-navigation-history-design.md:266-270` 的日志页局部状态范围是否可接受，即本轮只保证回到日志页，不恢复展开行/局部搜索
- implement 需要重点遵守：
  - `.codestable/features/2026-06-28-panel-global-navigation-history/panel-global-navigation-history-design.md:146-175` 的 `push / replace / back / normalize` 约束
  - `.codestable/features/2026-06-28-panel-global-navigation-history/panel-global-navigation-history-design.md:202-224` 的微重构边界，只抽导航纯状态，不顺手扩散到连接管理
- code review / QA / acceptance 需要重点复核：
  - 同类详情切换不能堆历史
  - sender/response 删除后 `back` 不能指向失效详情
  - 输入控件里触发鼠标侧键不能误切页

## 5. Residual Risk

- 宽屏语义仍有产品选择空间：当前 design 倾向统一“返回来源页/列表页”，而不是保留宽屏特有的“只清空右侧详情选中”行为；这不是实现缺口，但需要用户 review 时明确接受
- 日志页的 `expandedIds`、`typeFilter`、`searchText` 仍是组件私有 state；本轮 route history 不恢复这些细节。如果用户把“跳回来”理解成“恢复完整日志浏览上下文”，实现阶段需扩 scope

## 6. Verdict

- Status: passed
- Next: 交给用户整体 review；若用户认可这份 design，下一步进入 `cs-feat-impl` 实现阶段
