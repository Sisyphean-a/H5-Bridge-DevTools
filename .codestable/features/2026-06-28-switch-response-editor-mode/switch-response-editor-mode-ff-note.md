---
doc_type: feature-ff-note
feature: switch-response-editor-mode
date: 2026-06-28
requirement:
tags: [panel, response-editor, image-tools]
---

## 做了什么
把响应编辑器改成模式切换。
默认是文字模式，需要处理图片时再切到图片模式，不再默认铺开图片工具和解释文案。

## 改了哪些
- `src/panel/components/rules/ResponsesView.tsx:ResponseDetailPane` — 新增“编辑模式”选择，默认文字模式，并按模式切换 `Detail JSON` 与图片工具。
- `src/panel/components/rules/ResponseImageTools.tsx:ResponseImageTools` — 去掉展开/收起和说明文案，只保留图片模式下需要的控件。
- `scripts/verify-extension-e2e.mjs`、`src/panel/components/rules/ResponsesView.test.tsx` — 更新端到端和默认渲染验证。

## 怎么验证的
`npm run typecheck`、`npm run test`、`npm run build`、`npm run test:e2e` 全部通过。
真实浏览器场景继续验证了跨页同步，以及 Base64 / 模拟 Android URI 两种图片写回。
