---
doc_type: issue-fix
issue: 2026-06-28-devtools-panel-context-invalidation
path: fast-track
fix_date: 2026-06-28
tags:
  - chrome-extension
  - devtools
  - panel
  - runtime-lifecycle
---

# DevTools Panel 失效上下文自动重连报错 修复记录

## 1. 问题描述

DevTools 面板在扩展热重载或旧扩展上下文失效后，`usePanelConnection` 仍会按断线重连路径继续执行 `chrome.runtime.connect(...)`。此时控制台会低频出现 `Cannot read properties of undefined (reading 'connect')` 和 `Extension context invalidated`，但重新打开面板后功能通常恢复。

## 2. 根因

`src/panel/usePanelController.ts` 的 `usePanelConnection` 只区分了“port 断开”这一类事件，没有区分“当前 panel 所在扩展上下文已经失效”。旧上下文被销毁后，自动重连逻辑仍会继续读取 `chrome.runtime.connect` 或直接调用它，于是触发未捕获异常。

## 3. 修复方案

1. 在 panel 重连前显式检查 `chrome.runtime` 是否仍具备有效的 `id` 和 `connect` 能力。
2. 对 `runtime.connect(...)` 抛出的 `Extension context invalidated` 做定向识别，停止继续重连。
3. 通过现有 toast 机制把失效状态显式提示为“关闭并重新打开 DevTools 面板”，不吞掉其他未知错误。

## 4. 改动文件清单

- `src/panel/usePanelController.ts`
- `src/panel/helpers.ts`
- `src/panel/helpers.test.ts`

## 5. 验证结果

- `npm run typecheck` 通过
- `npm run test` 通过（26 tests）
- `npm run build` 通过
- 单测覆盖了 panel runtime 有效性判断，以及 `Extension context invalidated` 错误识别

## 6. 遗留事项

- 尚未在真实 Chrome DevTools “保持旧 panel 打开后热重载扩展”的场景下做端到端手工验证；需要在该场景下确认面板只提示重新打开，不再抛出未捕获异常
- CodeStable 要求的 `codestable-worktree-gate.py` 当前仓库缺失，无法执行 start/commit gate
