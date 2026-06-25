---
doc_type: feature-ff-note
feature: rule-editor-shortcuts
date: 2026-06-24
requirement:
tags:
  - panel
  - shortcut
  - rule-editor
---

## 做了什么
给规则编辑页增加常用快捷键，支持 `Ctrl/Cmd+S` 保存；在窄屏规则编辑态支持鼠标后退键返回上一页。
同时修复了规则编辑页里启用/禁用开关会被快照刷新覆盖，导致看起来“改不了”的问题。

## 改了哪些
- `src/panel/components/RuleEditor.tsx` — 让规则编辑容器主动拿焦点，在容器级处理 `Ctrl/Cmd+S` 保存，并监听鼠标后退键返回上一页
- `src/panel/helpers.ts` — 调整快照同步逻辑，存在未保存草稿时不再用旧快照覆盖当前编辑态
- `src/panel/usePanelController.ts` / `src/panel/App.tsx` / `src/panel/styles.css` — 把保存反馈改成明确的成功 toast，并提高可见性

## 怎么验证的
跑通了 `npm run typecheck` 和 `npm run build`。
代码路径上，规则编辑页的启用状态会保留到保存动作为止，快捷键会直接触发对应操作。
