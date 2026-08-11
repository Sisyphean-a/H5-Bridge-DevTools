---
scope: package:h5-bridge-devtools
code-paths:
  - public/manifest.json
  - scripts/build.mjs
  - src
---

# h5-bridge-devtools 架构

Chrome Manifest V3 DevTools 扩展，在受支持页面中模拟可配置的 Android/H5 桥接，并在 DevTools 面板管理规则、响应和日志。

## 入口与分层

- `src/devtools/devtools.ts` 创建 DevTools 面板；`src/panel/` 通过 React 展示规则工作区、日志、手动发送和设置。
- `src/injected/injectMain.ts` 运行在页面主世界：绑定当前方案的宿主对象，捕获 `postMessage`，并把配置的响应回放为 `window` 的 `CustomEvent`。
- `src/content/controller.ts`、`src/content/runtime.ts` 运行在 content script：读取页面桥接调用、更新当前 origin 的快照、执行规则命令，并监听存储变化。
- `src/background/serviceWorker.ts` 只接收一次性面板命令并转发到 tab；content script 缺失时，按 main-world injected script、content script 的顺序重新注入并重试。
- `src/shared/` 是跨层类型、消息、存储、方案、预置和纯规则逻辑的唯一契约层。

## 状态与同步

`chrome.storage.local` 中的 `h5BridgeDevTools:v2` 是共享状态来源（`src/shared/constants.ts`、`src/shared/storage.ts`）。状态先按 origin，再按活动 bridge profile 分桶；每个桶拥有发送条目、日志和设置（`src/shared/bridgeTypes.ts`）。content 和 panel 都监听该存储键刷新已打开实例，panel 的未保存草稿仍保留并提示远端更新（`src/content/runtime.ts`、`src/panel/runtimeBridge.ts`、`src/panel/helpers.ts`）。

旧 `h5BridgeDevTools:v1` 的单规则数据仅在首次读取时迁移到当前结构（`src/shared/migrate.ts`）。

## 桥接调用路径

1. 注入脚本按活动方案选择一个页面宿主对象；方案定义于 `src/shared/bridgeProfiles.ts`。
2. H5 调用该对象的 `postMessage` 后，注入脚本把原始值和解析结果作为 `BRIDGE_CALL` 发给页面自身。
3. content controller 提取 `parsedMessage.event`、记录日志，并在全局开关和自动模拟均开启时查找活跃响应。
4. 命中的响应经延迟后作为 `DISPATCH_EVENT` 回到注入脚本，后者 `dispatchEvent(new CustomEvent(eventName, { detail }))`。

请求与响应的领域语义、匹配边界见 [bridge-simulation](../../requirements/contexts/bridge-simulation.md)。

## 面板与预览

规则页分为自动配对、`H5 -> 安卓` 和 `安卓 -> H5` 三个视图（`src/panel/components/RuleWorkspace.tsx`）。`src/panel/navigationState.ts` 是 tab、详情和后退历史的唯一导航状态层；它跳过已删除对象并避免在可编辑控件中截获鼠标后退键。

`src/panel/preview.tsx` 与 `src/panel/previewRuntime.ts` 为开发预览提供受控 Chrome API 模拟，不是扩展生产通信路径。
