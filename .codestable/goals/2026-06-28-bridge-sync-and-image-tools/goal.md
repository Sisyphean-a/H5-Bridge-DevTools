---
doc_type: goal
goal: bridge-sync-and-image-tools
status: complete
---

# bridge-sync-and-image-tools

## Objective

实现同 origin 多页面与其 DevTools 面板之间的实时数据同步，并为桥接响应编辑器增加图片上传与格式切换能力。

## Starting Point

当前规则、设置、日志按 origin 存在 `chrome.storage.local`，但页面间不会自动刷新本地运行态，通常需要关闭并重新打开 DevTools 才能看到其他页面写入的新数据。响应编辑器当前只有 `Detail JSON` 文本框，没有图片上传、替换和常见图片格式写入能力。

## Acceptance Criteria

- 同 origin 的已打开页面与 DevTools 面板，在任一页面修改规则、设置或产生日志后，其他已打开页面和面板能自动拿到新快照，不再依赖手动关闭重开。
- 同步优先采用事件驱动；不额外引入 1 秒轮询，除非事件链路验证失败。
- 响应编辑器支持选择本地图片文件，并可将图片写入当前响应的 `detail` JSON。
- 图片写入至少支持两类常见格式：模拟 Android URI 字符串、Base64 字符串。
- 用户可在同一张已选择图片上切换写入格式并重新写入，无需每次重新编辑整段 JSON。

## Non-Goals

- 不引入跨 origin 共享。
- 不重做现有规则模型或日志模型。
- 不承诺生成真实 Android 系统返回的物理路径；URI 方案以可调试的模拟字符串为准。

## Decisions And Assumptions

- “跨页面同步”按同 origin 的所有已打开页面和已打开 DevTools 面板理解。
- 若浏览器扩展存储变更事件足以驱动同步，则优先采用该机制，不做轮询兜底。
- 图片工具建立在现有 JSON 编辑器之上，保留手工 JSON 编辑入口。

## Current State

已完成事件驱动跨页同步、panel 草稿同步修正、图片上传与格式切换工具，并补齐真实浏览器黑盒验收。`npm run typecheck`、`npm test`、`npm run build`、`npm run test:e2e` 全部通过；黑盒验收已确认第二个面板会收到快照更新、第二个页面无需重载即可拿到新响应、图片工具可写入 Base64 与模拟 Android URI。独立验收子代理 `Confucius` 复核后给出 `pass`。

## Next Action

无，goal 已达成。
