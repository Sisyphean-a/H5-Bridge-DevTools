---
doc_type: goal-functional-acceptance
goal: bridge-sync-and-image-tools
status: pass
reviewer: Confucius
---

# bridge-sync-and-image-tools 功能验收

## Reviewer And Scope

- Reviewer: `Confucius`（独立只读验收子代理）
- Scope: 同 origin 多页面实时同步；响应图片上传与格式切换

## Acceptance Checks

- 同 origin 的已打开页面与 DevTools 面板，在任一页面修改规则、设置或产生日志后，其他已打开页面和面板能自动拿到新快照。
- 响应编辑器支持选择本地图片文件，并可将图片写入当前响应的 `detail` JSON。
- 图片写入支持模拟 Android URI 与 Base64 两类格式。
- 用户可在同一张已选择图片上切换写入格式并重新写入。

## Functional Evidence

- 跨页同步代码链路完整：内容脚本监听 `chrome.storage.onChanged`，命中共享 `STORAGE_KEY` 后重载快照并重新发布 `SNAPSHOT`。
- DevTools 面板链路完整：background 缓存并转发 `CONTENT_READY` / `SNAPSHOT`，面板侧收到快照后刷新 UI。
- 自动化测试已覆盖共享存储到第二个 runtime 的自动同步、background 到 panel 的 `SNAPSHOT` 转发，以及 clean / dirty draft 的同步分支。
- 图片工具已接入响应编辑器，具备文件选择、格式切换、目标字段、预览和写回当前 JSON 的能力；`androidUri` 写入模拟 URI，`base64` 通过 `FileReader` 生成 Base64，并支持点路径写回。
- 运行证据：`npm run typecheck` 通过，`npm test` 8 个测试文件 / 36 个测试全部通过，`npm run build` 通过。
- 浏览器级黑盒证据：`npm run test:e2e` 通过，真实 Chromium 扩展场景下验证了 `panel-b-received-snapshot-update`、`page-b-received-updated-response-without-reload`、`image-tool-wrote-base64`、`image-tool-wrote-android-uri` 四项检查，最终响应同时包含 Base64 数据与模拟 URI。

## Verdict

`pass`

验收通过。跨页同步已经由真实浏览器扩展黑盒场景证明不再依赖重开 DevTools，图片工具也已证明可在同一套编辑流里完成上传、格式切换与写回。

## Residual Risks

- 面板在本地已修改草稿时会保留当前编辑内容，只通过提示告知远端更新；这是刻意保留的编辑安全策略，不是验收缺陷。

## Follow-Up

- 无。
