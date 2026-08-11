# 为项目生成可导入的桥接规则包

面向：已有 H5/原生桥接、但不想通读项目源码的开发者。

目标：只收集每个桥接调用的**宿主对象、请求事件、回包事件和回包数据**，生成可直接导入 H5 桥接调试工具的 JSON 或 YAML 文件。

> 本工具模拟的是 `window.<hostObject>.postMessage(...)` 和 `window.dispatchEvent(new CustomEvent(...))`。如果项目不是这两种机制，请先确认是否需要适配层。

## 1. 先收集最小事实

每个项目只需要确认下面四项，不必读完整代码：

| 要填的内容 | 去哪里找 | 示例 |
| --- | --- | --- |
| 宿主对象 | H5 调用原生的那一行 | `window.AcmeBridge.postMessage(...)` → `AcmeBridge` |
| 请求事件字段和值 | `postMessage` 传入对象（或 JSON 字符串）中表示事件的字段 | `{ eg18Code: "openCamera" }` → 字段 `eg18Code`、值 `openCamera` |
| 回包事件 | H5 的 `window.addEventListener(...)` 事件名，或 `window.dispatchEvent` 拦截器读取的 `event.type` | `addEventListener("cameraResult", ...)` → `cameraResult` |
| 回包数据 | 监听器或拦截器从 `event.detail` 读取的字段 | `event.detail.uri`、`event.detail.success` |

### 快速定位，而不是通读代码

在项目根目录执行以下任一命令，只检查桥接相关行：

```bash
rg -n "postMessage\(|addEventListener\(" src
rg -n "window\.[A-Za-z_$][A-Za-z0-9_$]*\.postMessage" src
```

如果能运行 H5 页面，可在**测试页面**的控制台临时记录真实请求。将 `AcmeBridge` 替换为实际宿主对象名：

```js
const bridge = window.AcmeBridge;
const originalPostMessage = bridge.postMessage;

bridge.postMessage = function (message, ...rest) {
  const parsed = typeof message === "string" ? JSON.parse(message) : message;
  console.log("桥接请求", { raw: message, parsed });
  return originalPostMessage.call(this, message, ...rest);
};

// 测完恢复：bridge.postMessage = originalPostMessage;
```

若字符串不是 JSON，上面 `JSON.parse` 会报错；此时记录原始字符串，并确认项目实际的请求协议。工具只会从对象或 JSON 字符串的一个顶层字段读取事件；把该字段写入 `profile.requestEventField`，未填写时默认为 `event`。

## 2. 判断项目是否适用

满足全部条件时，可以直接生成规则包：

1. H5 通过 `window.<自定义名称>.postMessage(...)` 发请求；
2. 请求值是对象，或可解析成对象的 JSON 字符串；
3. 对象中有一个顶层字符串字段表示事件（把字段名填入 `profile.requestEventField`）；
4. H5 通过 `window.addEventListener(回包事件, handler)` 接收回包，或拦截 `window.dispatchEvent`，并从 `CustomEvent.detail` 读取数据。

不满足时不要猜：

- 事件字段不是顶层字符串，或依赖多个字段共同决定事件：当前工具不能自动配对；
- 回包不是 `CustomEvent`，而是原生回调、Promise 或全局函数：当前工具不能直接模拟；
- 页面使用 `window.AndroidBridge`、`window.solvivaScope`：可沿用内置方案，也可以导入自己的规则包。

## 3. 填写规则包

每个规则包包含一个桥接方案和完整的发送条目。YAML 与 JSON 字段完全一致；选择其中一种格式即可。

```yaml
version: 1
name: Acme H5 桥接
profile:
  id: acme-h5
  title: Acme H5
  hostObject: AcmeBridge
  requestEventField: event
settings:
  autoMock: true
  overrideExistingBridge: true
senders:
  - name: 打开相机
    matchEvent: openCamera
    responses:
      - name: 拍照成功
        delayMs: 300
        eventName: cameraResult
        detail:
          success: true
          uri: "mock://camera/photo.jpg"
      - name: 用户取消
        delayMs: 0
        eventName: cameraResult
        detail:
          success: false
          message: 用户取消拍照
```

对应 JSON：

```json
{
  "version": 1,
  "name": "Acme H5 桥接",
  "profile": {
    "id": "acme-h5",
    "title": "Acme H5",
    "hostObject": "AcmeBridge",
    "requestEventField": "event"
  },
  "settings": {
    "autoMock": true,
    "overrideExistingBridge": true
  },
  "senders": [
    {
      "name": "打开相机",
      "matchEvent": "openCamera",
      "responses": [
        {
          "name": "拍照成功",
          "delayMs": 300,
          "eventName": "cameraResult",
          "detail": {
            "success": true,
            "uri": "mock://camera/photo.jpg"
          }
        }
      ]
    }
  ]
}
```

### 字段规则

| 字段 | 必填 | 规则 |
| --- | --- | --- |
| `version` | 是 | 固定为数字 `1` |
| `name` | 是 | 规则包名称，方便人识别 |
| `profile.id` | 是 | 稳定唯一标识；仅用字母、数字、`.`、`_`、`-`，最多 64 位，以字母或数字开头 |
| `profile.title` | 是 | 面板显示名称，最多 80 个字符 |
| `profile.hostObject` | 是 | 不带 `window.`，例如 `AcmeBridge`；必须是自定义 JavaScript 属性名，不能使用 `location`、`alert`、`postMessage` 等浏览器保留名 |
| `profile.requestEventField` | 否 | 请求对象中保存事件名的顶层字段；必须是 JavaScript 属性名，省略时为 `event`，例如 `eg18Code` |
| `settings` | 否 | 省略时沿用当前方案的设置 |
| `settings.autoMock` | 否 | 布尔值；是否自动回包 |
| `settings.overrideExistingBridge` | 否 | 布尔值；页面已有同名桥接时是否覆盖 |
| `settings.preserveLogs` | 否 | 布尔值；是否在刷新后保留日志 |
| `settings.maxLogCount` | 否 | 大于 0 的整数 |
| `senders` | 是 | 所有待模拟请求的数组；可以为空数组 |
| `senders[].name` | 是 | 请求的显示名称 |
| `senders[].matchEvent` | 是 | 与真实请求 `event` **完全一致**；同一规则包只保留一条相同值 |
| `responses` | 是 | 该请求的可选回包数组；可以为空数组 |
| `responses[].name` | 是 | 回包的显示名称 |
| `responses[].delayMs` | 是 | 非负数字，单位毫秒 |
| `responses[].eventName` | 是 | H5 监听的回包事件名；不一定等于 `matchEvent` |
| `responses[].detail` | 否 | 传给 `CustomEvent.detail` 的 JSON 数据；未填为 `null` |
| `id`、`activeResponseId`、`lastActiveResponseId` | 否 | 可不写；导入时会自动生成并默认选中第一条回包 |

`detail` 只能包含 JSON 数据：对象、数组、字符串、数字、布尔值和 `null`。不要放函数、`undefined`、`BigInt` 或循环引用。

## 4. 从一条真实调用生成一条规则

假设控制台记录到：

```js
window.AcmeBridge.postMessage(JSON.stringify({
  event: "getUserInfo",
  source: "profile-page"
}));

window.addEventListener("userInfoResult", (event) => {
  renderUser(event.detail.name, event.detail.avatar);
});
```

对应规则应为：

```yaml
- name: 获取用户信息
  matchEvent: getUserInfo
  responses:
    - name: 已登录用户
      delayMs: 0
      eventName: userInfoResult
      detail:
        name: 张三
        avatar: "https://example.test/avatar.png"
```

不要把请求中的 `source`、`payload` 等字段写到 `matchEvent`：工具只按 `profile.requestEventField` 指定的顶层字段精确匹配。若同一个事件需要按参数返回不同结果，当前工具不能区分参数；为该事件配置多个候选回包，再在面板中切换活跃回包。

## 5. 导入和验收

1. 保存为 `acme-bridge.yaml`、`acme-bridge.yml` 或 `acme-bridge.json`；
2. 打开目标页面的 DevTools → **H5 桥接** → 工具栏 **导入**；
3. 选择策略：
   - **替换**：用文件中的发送条目替换该方案现有条目；首次导入推荐；
   - **合并**：按 `matchEvent` 合并；
   - **追加但不关联**：导入后不自动回包，适合先人工检查；
4. 导入后确认已切换到 `profile.title` 对应方案；
5. 触发一次真实 H5 操作，日志应先出现 `SEND <matchEvent>`，随后出现 `MOCK <eventName>`；
6. 在 H5 的回包监听器中确认 `event.detail` 的字段和类型与真实原生回包一致。

## 6. 导入失败或不生效时的排查

| 现象 | 优先检查 |
| --- | --- |
| 文件无法导入 | `version` 是否为数字 `1`；YAML 缩进是否正确；所有 `name`、`matchEvent`、`eventName` 是否为非空字符串 |
| 找不到或无法覆盖桥接 | `hostObject` 不要写 `window.`；确认名称与 H5 调用完全一致；不要使用浏览器保留名 |
| 有 `SEND` 没有 `MOCK` | `profile.requestEventField` 或 `matchEvent` 与真实请求不一致；全局模拟或 `autoMock` 被关闭；该条目没有活跃回包 |
| 有 `MOCK` 但页面没反应 | `eventName` 不等于 H5 监听/拦截的事件；`detail` 字段名或类型与 H5 读取方式不一致 |
| 切换/更新方案后旧宿主仍存在 | 刷新目标页面；扩展会恢复已知的非活动 mock 宿主 |

## 最终交付前检查

把下面这份清单和规则包一起交给项目负责人确认：

- [ ] `hostObject` 来自实际 `window.<host>.postMessage` 调用；
- [ ] `profile.requestEventField` 来自真实请求的事件字段；每条 `matchEvent` 来自该字段的真实值；
- [ ] 每条 `eventName` 来自真实 `addEventListener` 监听名；
- [ ] 每个 `detail` 字段和类型都有真实回包、接口文档或项目负责人作为依据；
- [ ] 每个 `matchEvent` 在规则包中只出现一次；
- [ ] 已用目标页面完成一次 `SEND → MOCK → H5 页面更新` 验收。
