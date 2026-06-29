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

# Content Script 未随 MV3 Worker 恢复连接 修复记录

## 1. 问题描述

DevTools 面板会周期性弹出“当前页面未连接 content script。”；频率接近 MV3 service worker 的空闲回收周期，页面本身并未离开匹配域名。

## 2. 根因

1. `src/content/controller.ts` 中 content script 的 `chrome.runtime.Port` 断开后只会置位 `portConnected=false`，不会重新连接新的 background worker。
2. `src/background/serviceWorker.ts` 将 content port 和快照缓存都保存在 worker 内存里；worker 被回收后，panel 重连并立刻发 `REQUEST_SNAPSHOT`，此时 content port 尚未恢复，background 会把启动阶段的缺口误判成错误。

## 3. 修复方案

1. 抽出 content 端口生命周期模块，端口断开后自动重连，并在新连接建立后重新发送 `CONTENT_READY`。
2. `REQUEST_SNAPSHOT` 在无 content port 但已有缓存快照时只回放缓存，不再提示“未连接 content script”。

## 4. 改动文件清单

- `src/content/controller.ts`
- `src/content/portConnection.ts`
- `src/content/controller.test.ts`
- `src/background/serviceWorker.ts`
- `src/background/serviceWorker.test.ts`

## 5. 验证结果

- `npm run test -- src/content/controller.test.ts src/background/serviceWorker.test.ts` 通过
- `npm run typecheck` 通过
- `npm run build` 通过

## 6. 遗留事项

- service worker 重启到 content script 重连之间仍存在极短窗口，但启动阶段的 `REQUEST_SNAPSHOT` 已改为回放缓存快照，不再向面板抛出误导性错误。
