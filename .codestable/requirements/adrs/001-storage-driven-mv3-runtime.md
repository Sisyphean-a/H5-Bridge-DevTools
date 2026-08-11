---
status: accepted
date: 2026-06-29
scope: package:h5-bridge-devtools
---

# ADR-001：以存储驱动 MV3 运行时，而非依赖常驻 worker 端口

## 背景

Chrome 可回收 Manifest V3 service worker。若 content script、DevTools panel 和 background 依赖长期 `runtime.Port` 及 worker 内存映射，worker 休眠会让快照同步和命令投递短暂或持续失联。

## 决定

- `chrome.storage.local` 是规则、设置和日志的共享状态来源；已打开 content script 与 panel 监听其变化并刷新快照。
- panel 用一次性 `runtime.sendMessage` 发出命令；background 无状态地用 `tabs.sendMessage` 转发。
- 若 tab 没有 content 收件端，background 先程序化注入 `injectMain.js` 和 `contentScript.js`，再重试一次命令。
- 注入脚本必须幂等，以允许恢复路径重复执行。

代码锚点：`src/background/serviceWorker.ts`、`src/content/controller.ts`、`src/content/runtime.ts`、`src/panel/runtimeBridge.ts`、`src/injected/injectMain.ts`。

## 备选方案

- 保持长期 Port 并在断开后重连：拒绝。它只能缓解端口失效，不能消除功能对可回收 worker 内存的依赖。
- 阻止 worker 休眠：拒绝。平台不保证此能力。

## 后果

状态同步不再要求 worker 常驻；扩展被手动重载后，已打开页面仍需重新打开面板或执行命令，才能触发重新注入并恢复旧页面监听。该限制来自扩展上下文已被销毁，而不是同步回退机制。

## 相关历史

见 [2026-06 演进记录](../../history/2026-06.md#2026-06-29--演进-以存储驱动-mv3-运行时)。
