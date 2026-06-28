---
doc_type: feature-ff-note
feature: toggle-image-tools-visibility
date: 2026-06-28
requirement:
tags: [panel, response-editor, image-tools]
---

## 做了什么
把响应编辑器里的图片辅助改成默认收起、按需展开。
普通文字桥接继续直接编辑 `Detail JSON`，只有处理图片时才展开图片工具，界面更干净。

## 改了哪些
- `src/panel/components/rules/ResponseImageTools.tsx:ResponseImageTools` — 增加展开/收起状态，切换响应时重置为收起，并在收起态只保留轻量入口说明。
- `src/panel/components/rules/ResponseImageTools.test.tsx` — 新增默认收起渲染测试，防止图片控件再次默认铺开。
- `scripts/verify-extension-e2e.mjs:writeImageWithTool` — 端到端脚本先展开图片工具，再继续走图片写回验收。

## 怎么验证的
`npm run typecheck`、`npm run test`、`npm run build`、`npm run test:e2e` 全部通过。
真实浏览器场景继续验证了跨页同步，以及 Base64 / 模拟 Android URI 两种图片格式写回。
