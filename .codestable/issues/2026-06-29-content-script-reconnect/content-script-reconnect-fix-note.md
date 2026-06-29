---
doc_type: issue-fix
issue: 2026-06-29-content-script-reconnect
path: fast-track
fix_date: 2026-06-29
tags:
  - chrome-extension
  - mv3
  - service-worker
  - content-script
---

# MV3 Worker 休眠导致调试链路抖动 修复记录

## 1. 问题描述

DevTools 面板会周期性弹出“当前页面未连接 content script。”；频率接近 MV3 service worker 的空闲回收周期。进一步分析后确认问题不只是一条误报，而是调试链路把热路径建立在了会被回收的 background 内存和长连接上。

## 2. 根因

1. content script、panel、background 之间原本依赖 `runtime.connect` 长连接；MV3 worker 回收后，background 内存态和端口映射一起消失。
2. content script 的日志采集、panel 的快照同步都间接依赖这条链路，导致 worker 休眠时出现短暂失联，扩展重载后旧页面还会彻底失去注入。
3. 仅靠“断线后自动重连”只能缓解误报，无法从结构上消除对 worker 常驻的依赖。

## 3. 修复方案

1. content script 改成常驻监听 `window.message`、`storage.onChanged`、`runtime.onMessage`，不再维护 background port。
2. panel 改成直接按当前 tab URL 从 `chrome.storage` 构建快照，并订阅 `storage.onChanged` 与 `tabs.onUpdated`；不再通过 background 长连接接收快照。
3. background 改成无状态命令转发：收到 panel 的一次性消息后，用 `tabs.sendMessage` 打到 content script；若收件端不存在，则用 `chrome.scripting.executeScript()` 重新注入 `injectMain.js` 与 `contentScript.js` 后重试。
4. 为程序化重注入增加幂等保护，避免重复注入造成双重监听。

## 4. 改动文件清单

- `src/content/controller.ts`
- `src/content/contentScript.ts`
- `src/content/runtime.ts`
- `src/injected/injectMain.ts`
- `src/background/serviceWorker.ts`
- `src/background/serviceWorker.test.ts`
- `src/panel/actionContext.ts`
- `src/panel/helpers.ts`
- `src/panel/runtimeBridge.ts`
- `src/panel/runtimeBridge.test.ts`
- `src/panel/usePanelController.ts`
- `src/panel/previewRuntime.ts`
- `src/panel/actions.test.ts`
- `src/panel/helpers.test.ts`
- `src/content/runtime.test.ts`
- `src/shared/messageTypes.ts`
- `src/shared/global.d.ts`
- `public/manifest.json`

## 5. 验证结果

- `npm run test` 通过（49/49）
- `npm run typecheck` 通过
- `npm run build` 通过

## 6. 遗留事项

- MV3 worker 仍会被 Chrome 回收，这是平台约束；本次修复解决的是“功能依赖它常驻”的问题，而不是试图阻止回收本身。
- 若扩展在页面打开期间被手动重载，旧页面要等面板重新打开或用户执行一次命令后，background 才会触发重注入恢复监听。
