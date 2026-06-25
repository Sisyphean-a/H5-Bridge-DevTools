---
doc_type: issue-fix
issue: 2026-06-24-devtools-port-lifecycle
path: fast-track
fix_date: 2026-06-24
tags:
  - chrome-extension
  - devtools
  - port-lifecycle
---

# DevTools 端口断链导致日志操作失效 修复记录

## 1. 问题描述

页面刷新或进入 back/forward cache 后，控制台持续出现 `Attempting to use a disconnected port object`、`Extension context invalidated`、`The page keeping the extension port is moved into back/forward cache` 等报错；同时 DevTools 面板里的“清空日志”在部分时机没有生效。

## 2. 根因

1. content script 建立的 `chrome.runtime.Port` 断开后，运行时仍继续通过该 port 推送快照事件。
2. background 侧按 `tabId` 维护 content port，但旧连接断开时会无条件删除映射；刷新时新旧连接交错，旧 port 的 `onDisconnect` 会把新 port 一并删掉，导致面板命令可能发不到当前页面。
3. 旧 content script 在扩展上下文失效后，仍可能继续响应页面 `message` 事件并尝试读写 `chrome.storage.local`，因此会出现 `Cannot read properties of undefined (reading 'local')`。

## 3. 修复方案

1. 在 content runtime 中显式维护 `portConnected` 状态，port 断开后停止发送消息。
2. 在 background 的 `onDisconnect` 中增加“当前映射仍然是这个 port”校验，只移除当前活跃连接。
3. 在 content script 断开时移除页面消息监听，并在运行时状态变更前后二次检查 `portConnected`，避免旧上下文继续触发存储写入。

## 4. 改动文件清单

- `src/content/controller.ts`
- `src/content/runtime.ts`
- `src/background/serviceWorker.ts`

## 5. 验证结果

- `npm run typecheck` 通过
- `npm run build` 通过
- 代码路径上，“清空日志”命令会稳定发往当前 content port；旧页面/旧 port 断开后不再继续 `postMessage`

## 6. 遗留事项

- `Extension context invalidated` 在“手动重载扩展但不刷新页面”场景下仍可能出现一次性旧上下文报错，这是 Chrome 扩展上下文被销毁后的既有页面残留现象；刷新页面后会恢复到新上下文
