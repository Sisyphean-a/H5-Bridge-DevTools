# 架构索引

## 范围地图

- [package:h5-bridge-devtools](packages/h5-bridge-devtools.md)：唯一工作区包；MV3 扩展入口、页面桥接、存储、面板和预览实现。

本仓库没有第二个代码包，`architecture/shared/` 目前没有跨包架构契约。

## 代码入口与公开边界

- 扩展声明、权限与允许注入的站点：`public/manifest.json`。
- 产物入口：`scripts/build.mjs`（background、content、main-world injected script）与 `vite.config.ts`（panel）。
- DevTools 入口：`src/devtools/devtools.ts`；面板根：`src/panel/panel.tsx`。
- 页面可见桥接入口：当前方案的 `window.<hostObject>.postMessage`；注入和回放位于 `src/injected/injectMain.ts`。
- 面板命令边界：`src/shared/messageTypes.ts`；background 转发：`src/background/serviceWorker.ts`。

## 关键当前设计

- 持久状态按 `origin + bridge profile` 切分，存于 `chrome.storage.local`；数据形状和迁移在 `src/shared/bridgeTypes.ts`、`src/shared/storage.ts`、`src/shared/migrate.ts`。
- 自动模拟按 H5 请求的 `event` 精确匹配，不维护 requestId/callbackId 关联；规则选择与不变量见 [bridge-simulation 领域上下文](../requirements/contexts/bridge-simulation.md)。
- MV3 service worker 仅一次性转发面板命令；缺少 content 收件端时重新注入后重试。原因和替代方案见 [ADR-001](../requirements/adrs/001-storage-driven-mv3-runtime.md)。
- 面板导航由 `src/panel/navigationState.ts` 统一管理；详情路由失效时降级为可渲染列表页。

## 按需追溯

- 演进原因、旧术语和原始提交：[历史索引](../history/2026-06.md)。
