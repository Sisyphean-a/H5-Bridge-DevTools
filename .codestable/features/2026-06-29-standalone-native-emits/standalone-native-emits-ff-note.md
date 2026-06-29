---
doc_type: feature-ff-note
feature: standalone-native-emits
date: 2026-06-29
requirement:
tags: [panel, bridge, standalone-emit]
---

## 做了什么
把规则工作台里的“发送 / 响应”语义改成按方向区分：`H5 -> 安卓` 与 `安卓 -> H5`。
同时让 `安卓 -> H5` 页面支持创建不跟踪 H5 发送的独立安卓发送，用来保存并触发原生主动推给 H5 的消息模板。

## 改了哪些
- `src/shared/standaloneSender.ts`、`src/shared/rules.ts` — 新增独立安卓发送容器定义，并确保自动匹配时跳过它。
- `src/panel/controllerFilters.ts`、`src/panel/responseActions.ts`、`src/panel/navigationState.ts`、`src/panel/selectionState.ts` — 接入独立发送的筛选、创建、删除和本地详情路由保持。
- `src/panel/components/RuleWorkspace.tsx`、`src/panel/components/rules/*.tsx` — 更新方向文案；在安卓发送页加入“独立发送（不跟踪 H5 -> 安卓）”入口，并隐藏其在发送页/自动配对页的存在。
- `src/panel/actions.test.ts`、`src/panel/controllerFilters.test.ts`、`src/panel/components/rules/ResponsesView.test.tsx`、`src/shared/rules.test.ts` — 补独立发送创建、隐藏过滤和匹配跳过覆盖。

## 怎么验证的
运行 `npm run typecheck`、`npm run test`、`npm run build`，全部通过。
尝试运行 CodeStable worktree gate，但仓库内缺少 `.codestable/tools/codestable-worktree-gate.py`，本次未能执行该 gate。
