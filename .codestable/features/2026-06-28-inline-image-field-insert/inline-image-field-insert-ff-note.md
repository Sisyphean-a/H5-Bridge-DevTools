---
doc_type: feature-ff-note
feature: inline-image-field-insert
date: 2026-06-28
requirement:
tags: [panel, response-editor, image-tools, json]
---

## 做了什么
把响应编辑器改成始终保留 `Detail JSON` 文本区。
图片能力不再切模式，而是作为一个针对指定字段的插入工具条，直接把图片写回当前 JSON。

## 改了哪些
- `src/panel/components/rules/ResponsesView.tsx:ResponseDetailPane` — 移除文字/图片模式切换，让图片工具和 `Detail JSON` 同时可见。
- `src/panel/components/rules/ResponseImageTools.tsx:ResponseImageTools` — 收成字段导向的图片插入条，保留字段、格式、选图、预览和插入按钮。
- `src/panel/components/rules/ResponsesView.test.tsx`、`scripts/verify-extension-e2e.mjs` — 更新默认渲染和真实浏览器验收，验证 JSON 文本区与图片插入能同时工作。

## 怎么验证的
`npm run typecheck`、`npm run test`、`npm run build`、`npm run test:e2e` 全部通过。
真实浏览器场景继续验证了跨页同步，以及在同一份响应 JSON 中插入 Base64 / 模拟 Android URI 两种图片数据。
