---
doc_type: feature-ff-note
feature: toggle-image-field-tools
date: 2026-06-28
requirement:
tags: [panel, response-editor, image-tools]
---

## 做了什么
把图片字段工具改成默认隐藏。
响应编辑器里平时只看到 `Detail JSON` 和一个 `添加图片字段` 按钮，点击后才展开图片字段控件。

## 改了哪些
- `src/panel/components/rules/ResponseImageTools.tsx:ResponseImageTools` — 新增展开状态，默认隐藏图片字段控件，切换响应时自动收起。
- `src/panel/components/rules/ResponsesView.test.tsx` — 更新默认渲染验证，确认初始只显示入口按钮，不直接展示图片字段控件。
- `scripts/verify-extension-e2e.mjs:writeImageWithTool` — 端到端脚本改成按需展开图片字段工具，兼容连续插图场景。

## 怎么验证的
`npm run typecheck`、`npm run test`、`npm run build`、`npm run test:e2e` 全部通过。
真实浏览器场景继续验证了跨页同步，以及两次图片插入后的 Base64 / 模拟 Android URI 写回。
