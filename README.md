# H5 桥接调试工具

Chrome Manifest V3 开发者工具扩展，用于在浏览器里模拟 Android `window.AndroidBridge.postMessage(...)`，帮助 H5 页面在本地跑通登录、相机、联系人、活体、定位等依赖原生桥接的流程。

## 功能

- 开发者工具自定义 `H5 桥接` 面板
- `document_start` 注入 `window.AndroidBridge`
- 捕获桥接调用并记录 `发送 / 模拟 / 手动发送 / 警告 / 错误` 日志
- 按 `event` 规则自动 `dispatchEvent`
- 规则 CRUD、启用/禁用、复制、搜索
- 按 origin 存储规则与设置
- 导入 / 导出规则 JSON
- 手动发送原生消息
- 内置登录、相机、联系人、活体、定位、上传大 JSON、`baseRequest` 模板
- 从日志快速创建规则

## 安装依赖

```bash
npm install
```

## 本地开发

```bash
npm run dev
```

该命令会持续构建 `dist/`，可用于扩展开发调试。

## 构建扩展

```bash
npm run typecheck
npm run build
```

构建产物输出到 `dist/`。

## Chrome 加载已解压扩展程序

1. 打开 Chrome，进入 `chrome://extensions/`
2. 开启右上角 `开发者模式`
3. 点击 `加载已解压的扩展程序`
4. 选择项目里的 `dist/` 目录

## 如何使用

1. 打开目标 H5 页面，例如 `http://localhost:5173`
2. 按 `F12` 打开开发者工具
3. 切换到顶部 `H5 桥接` 面板
4. 保持“模拟已开启”
5. 在左侧选择模板创建规则，或新建空白规则
6. 页面调用：

```js
window.AndroidBridge.postMessage(JSON.stringify({ event: "openCamera" }))
```

7. 右侧日志会出现 `发送 openCamera`
8. 如果存在启用的 `openCamera` 规则，页面会收到：

```js
window.dispatchEvent(
  new CustomEvent("openCamera", {
    detail: {
      success: true,
      uri: "mock://camera/photo-001.jpg",
      data: "mock-image-data"
    }
  })
)
```

9. 面板日志会追加 `模拟 openCamera`
10. 可在“手动发送”区域手动发送原生事件测试页面监听逻辑

## 规则 JSON 格式

```ts
interface BridgeMockRule {
  id: string
  name: string
  enabled: boolean
  match: {
    event: string
  }
  response: {
    delayMs: number
    mode: "dispatchEvent"
    eventName: string
    detail: unknown
  }
  meta?: {
    createdAt?: number
    updatedAt?: number
    hitCount?: number
  }
}
```

导出文件格式：

```json
{
  "version": 1,
  "name": "H5 桥接调试工具规则",
  "origin": "http://localhost:5173",
  "exportedAt": 1780000000000,
  "rules": []
}
```

## 常见问题

### 1. 为什么页面没有 `window.AndroidBridge`？

- 确认当前页面域名命中 `manifest.json` 的 `matches`
- 确认扩展已重新加载
- 确认“设置”里的“覆盖 AndroidBridge”没有关闭，且页面原本没有同名原生桥接覆盖

### 2. 为什么有 `SEND` 没有 `MOCK`？

- 规则可能未启用
- “模拟已开启”或“自动模拟”可能已关闭
- 当前规则的 `match.event` 与发送的 `event` 不一致

### 3. 为什么导入后规则没有生效？

- 导入策略若为“追加为禁用”，导入规则会默认禁用
- 规则只按当前页面 `origin` 生效，请确认当前开发者工具面板对应的是目标页面

### 4. 日志为什么会被清空？

- 默认“保留日志 = false”
- 可在“设置”中开启保留日志并调整“日志上限”
