---
doc_type: implementation-guide
slug: bridge-rule-separation-next-steps
pitch: 数据层和状态层已完成，接下来实现三子页签 UI 和响应切换交互
status: ready
created_at: 2026-06-26
parent_requirement: bridge-rule-separation
tags:
  - bridge
  - panel
  - ui
  - implementation
---

# 桥接规则分离 - 下一步实现指南

## 已完成（2026-06-26）

### ✅ 数据层重构
- `BridgeSender` 模型：一个发送对应多个响应候选，`activeResponseId` 指向当前生效响应
- `BridgeResponseOption` 模型：独立的响应实体，可独立编辑、触发、切换
- 自动迁移逻辑：从旧 `BridgeMockRule[]` 迁移到 `BridgeSender[]`
- 存储层适配：`storage.ts` 读写新格式，启动时自动迁移

### ✅ 状态层重构
- `AppViewState` 扩展：新增 `selectedSenderId`、`senderDraft`、`selectedResponse`、`responseDraft`
- `usePanelController` 重写：所有命令和草稿逻辑切换到 sender/response 模型
- 同步逻辑：`syncSnapshotState` 处理 sender/response 草稿的脏检测和同步

### ✅ 命令层重构
- 新增命令：`UPSERT_SENDER`、`DELETE_SENDER`、`DUPLICATE_SENDER`、`TOGGLE_SENDER`
- 新增命令：`UPSERT_RESPONSE`、`DELETE_RESPONSE`、`SET_ACTIVE_RESPONSE`、`TRIGGER_RESPONSE`
- `BridgeMatcher` 适配：匹配时查找 sender 的活跃响应

### ✅ 基础 UI 适配
- `App.tsx`：`rules` → `senders`，命令切换
- `RulesList.tsx`：显示 sender 列表，展示活跃响应的 delayMs
- `RuleEditor.tsx`：暂时保持单响应编辑（编辑活跃响应）
- `Toolbar.tsx`：显示 senders 数量

## 待实现：三子页签 UI

### 目标
将当前的"规则"单页签拆分为三个子页签：**发送**、**响应**、**匹配**，让用户清晰看到发送、响应、配对关系三件事。

---

## 页签1：发送（Senders）

### 功能
管理所有发送桥接（`BridgeSender`），每个发送定义一个匹配条件。

### UI 布局
```
┌─────────────────────────────────────────────────────────┐
│ 发送 | 响应 | 匹配                              [+ 新建] │
├─────────────────────────────────────────────────────────┤
│ ┌─────────────────┐ ┌───────────────────────────────┐   │
│ │ 发送列表         │ │ 发送编辑器                     │   │
│ │                 │ │                               │   │
│ │ [搜索框]        │ │ 名称: ___________________      │   │
│ │                 │ │                               │   │
│ │ ☑ 登录          │ │ 匹配事件: _______________      │   │
│ │   toLogin       │ │                               │   │
│ │   [2 响应]      │ │ 启用: ☑                       │   │
│ │                 │ │                               │   │
│ │ ☐ 支付          │ │ 响应候选 (2):                  │   │
│ │   toPay         │ │ ┌─────────────────────────┐   │   │
│ │   [3 响应]      │ │ │ ● 登录成功 (活跃)        │   │   │
│ │                 │ │ │ ○ 登录失败               │   │   │
│ │ ...             │ │ └─────────────────────────┘   │   │
│ │                 │ │                               │   │
│ │                 │ │ [保存] [删除] [复制]          │   │
│ └─────────────────┘ └───────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### 交互细节
1. **列表项**：
   - 显示：`☑ 名称 / matchEvent / [N 响应]`
   - 点击展开编辑器
   - 复选框：快速启用/禁用该发送

2. **编辑器**：
   - 字段：`name`、`matchEvent`、`enabled`
   - **响应候选列表**（只读，显示该发送下的所有响应）：
     - ● 活跃响应（绿色圆点）
     - ○ 非活跃响应
     - 点击可切换活跃响应（调用 `SET_ACTIVE_RESPONSE`）
     - 点击响应名跳转到"响应"页签并选中该响应

3. **操作**：
   - **保存**：`UPSERT_SENDER`
   - **删除**：`DELETE_SENDER`（删除发送及其所有响应）
   - **复制**：`DUPLICATE_SENDER`

4. **新建**：
   - 点击 `[+ 新建]` 创建空白 sender
   - 自动创建一个空白响应作为默认活跃响应

---

## 页签2：响应（Responses）

### 功能
管理所有响应桥接（`BridgeResponseOption`），每个响应可独立编辑、触发、验证。

### UI 布局
```
┌─────────────────────────────────────────────────────────┐
│ 发送 | 响应 | 匹配                              [+ 新建] │
├─────────────────────────────────────────────────────────┤
│ ┌─────────────────┐ ┌───────────────────────────────┐   │
│ │ 响应列表         │ │ 响应编辑器                     │   │
│ │                 │ │                               │   │
│ │ [搜索框]        │ │ 名称: ___________________      │   │
│ │                 │ │                               │   │
│ │ ● 登录成功      │ │ 延迟(ms): _______              │   │
│ │   (登录)        │ │                               │   │
│ │   500ms         │ │ 事件名: _________________      │   │
│ │                 │ │                               │   │
│ │ ○ 登录失败      │ │ Detail (JSON):                │   │
│ │   (登录)        │ │ ┌─────────────────────────┐   │   │
│ │   500ms         │ │ │ {                       │   │   │
│ │                 │ │ │   "success": true,      │   │   │
│ │ ● 支付成功      │ │ │   "token": "..."        │   │   │
│ │   (支付)        │ │ │ }                       │   │   │
│ │   800ms         │ │ └─────────────────────────┘   │   │
│ │                 │ │                               │   │
│ │ ...             │ │ [保存] [删除] [格式化]         │   │
│ │                 │ │ [🚀 触发测试]                  │   │
│ └─────────────────┘ └───────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### 交互细节
1. **列表项**：
   - 显示：`● 名称 / (所属发送) / delayMs`
   - ● 绿色圆点：该响应是其所属发送的活跃响应
   - ○ 灰色圆点：非活跃响应
   - 点击展开编辑器

2. **编辑器**：
   - 字段：`name`、`delayMs`、`eventName`、`detail`（JSON 文本框）
   - 显示所属发送（只读，点击跳转到"发送"页签）

3. **操作**：
   - **保存**：`UPSERT_RESPONSE`
   - **删除**：`DELETE_RESPONSE`（删除后，如果该响应是活跃响应，自动切换到第一个剩余响应）
   - **格式化**：格式化 JSON
   - **🚀 触发测试**：`TRIGGER_RESPONSE`（立即触发该响应，验证页面监听逻辑）

4. **新建**：
   - 点击 `[+ 新建]` 弹出发送选择器
   - 选择一个发送后，在该发送下创建新响应

---

## 页签3：匹配（Matches）

### 功能
显示当前所有发送与响应的配对关系，快速切换活跃响应或关闭配对。

### UI 布局
```
┌─────────────────────────────────────────────────────────┐
│ 发送 | 响应 | 匹配                                       │
├─────────────────────────────────────────────────────────┤
│ 匹配关系列表                                             │
│                                                         │
│ ┌──────────────────────────────────────────────────┐   │
│ │ ☑ 登录 (toLogin)                    [🔗 配对中]  │   │
│ │   ├─ ● 登录成功 (500ms) ──────────────── [切换] │   │
│ │   └─ ○ 登录失败 (500ms)                          │   │
│ │                                      [关闭配对]   │   │
│ └──────────────────────────────────────────────────┘   │
│                                                         │
│ ┌──────────────────────────────────────────────────┐   │
│ │ ☑ 支付 (toPay)                      [🔗 配对中]  │   │
│ │   ├─ ● 支付成功 (800ms) ──────────────── [切换] │   │
│ │   ├─ ○ 支付失败 (800ms)                          │   │
│ │   └─ ○ 余额不足 (500ms)                          │   │
│ │                                      [关闭配对]   │   │
│ └──────────────────────────────────────────────────┘   │
│                                                         │
│ ┌──────────────────────────────────────────────────┐   │
│ │ ☐ 获取用户信息 (getUserInfo)      [无自动响应]   │   │
│ │   (无响应候选)                                    │   │
│ │                                      [添加响应]   │   │
│ └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### 交互细节
1. **配对卡片**：
   - 展示一个发送及其所有响应候选
   - ● 绿色圆点：当前活跃响应
   - ○ 灰色圆点：非活跃响应

2. **切换活跃响应**：
   - 点击 `[切换]` 或点击 ○ 圆点响应，调用 `SET_ACTIVE_RESPONSE`
   - 切换后，● 圆点移动到新的活跃响应

3. **关闭配对**：
   - 点击 `[关闭配对]`，将该发送的 `activeResponseId` 设为 `null`
   - 状态变为 `[无自动响应]`，该发送不再自动触发任何响应

4. **添加响应**：
   - 对于无响应的发送，点击 `[添加响应]` 跳转到"响应"页签并预填该发送

---

## 实现步骤

### 步骤1：重构 App.tsx，引入子页签路由
```typescript
// src/panel/types.ts
export type RulesSubTab = "senders" | "responses" | "matches";

export interface AppViewState {
  // ... 现有字段
  rulesSubTab: RulesSubTab; // 新增
}
```

在 `App.tsx` 中，当 `activeTab === "rules"` 时，渲染子页签切换器和对应内容：
```tsx
{state.activeTab === "rules" ? (
  <div>
    <SubTabBar
      active={state.rulesSubTab}
      onChange={(tab) => setState({ ...state, rulesSubTab: tab })}
    />
    {state.rulesSubTab === "senders" && <SendersView />}
    {state.rulesSubTab === "responses" && <ResponsesView />}
    {state.rulesSubTab === "matches" && <MatchesView />}
  </div>
) : null}
```

### 步骤2：实现 SendersView 组件
- 左侧：`SendersList`（复用现有 `RulesList` 逻辑，但增加响应数量显示）
- 右侧：`SenderEditor`（复用现有 `RuleEditor` 逻辑，但增加响应候选列表和切换按钮）

**关键新增逻辑**：
- `SenderEditor` 中显示 `sender.responses`，每个响应显示 ● 或 ○
- 点击响应名或圆点，调用 `postCommand({ type: "SET_ACTIVE_RESPONSE", senderId, responseId })`

### 步骤3：实现 ResponsesView 组件
- 左侧：`ResponsesList`（新组件，列表项显示响应名、所属发送、delayMs）
- 右侧：`ResponseEditor`（新组件，编辑响应字段 + 触发测试按钮）

**关键新增逻辑**：
- `ResponseEditor` 中增加 `[🚀 触发测试]` 按钮，调用 `postCommand({ type: "TRIGGER_RESPONSE", senderId, responseId })`
- 列表项根据 `sender.activeResponseId === response.id` 显示 ● 或 ○

### 步骤4：实现 MatchesView 组件
- 单列表，每个 `sender` 一张卡片
- 卡片展示：发送名 + 所有响应候选 + 活跃响应标记
- 操作按钮：
  - `[切换]`：弹出响应选择器，调用 `SET_ACTIVE_RESPONSE`
  - `[关闭配对]`：调用 `SET_ACTIVE_RESPONSE(senderId, null)`

### 步骤5：增强 usePanelController
新增方法：
```typescript
function setActiveResponse(senderId: string, responseId: string | null) {
  postCommand({ type: "SET_ACTIVE_RESPONSE", senderId, responseId });
}

function triggerResponse(senderId: string, responseId: string) {
  postCommand({ type: "TRIGGER_RESPONSE", senderId, responseId });
}

function addResponseToSender(senderId: string) {
  const response = createBlankResponse();
  postCommand({
    type: "UPSERT_RESPONSE",
    senderId,
    response,
  });
  // 可选：自动设为活跃响应
  postCommand({ type: "SET_ACTIVE_RESPONSE", senderId, responseId: response.id });
}
```

### 步骤6：测试与调试
1. 构建：`npm run build`
2. 加载扩展到 Chrome
3. 验证：
   - 创建发送 → 添加多个响应 → 切换活跃响应
   - 触发测试 → 观察页面是否收到响应
   - 关闭配对 → 验证不再自动响应
   - 删除响应 → 验证活跃响应自动切换

---

## UI 设计规范

### 颜色
- **活跃响应**：`#10b981`（绿色圆点）
- **非活跃响应**：`#6b7280`（灰色圆点）
- **无自动响应**：`#ef4444`（红色标签）

### 图标
- **🔗 配对中**：绿色链接图标
- **🚀 触发测试**：火箭图标
- **● ○**：实心/空心圆点（用 CSS `::before` 实现）

### 布局
- 所有子页签保持左右分栏（窄屏改为单栏）
- 左侧列表宽度 `320px`，可拖动调整
- 右侧编辑器自适应

---

## 边界与约束

1. **一个发送同一时刻只允许一个活跃响应**：UI 上用单选圆点表示
2. **删除发送会删除其所有响应**：需要二次确认弹窗
3. **删除活跃响应会自动切换到第一个剩余响应**：在 `controller.ts` 中处理
4. **关闭配对（`activeResponseId = null`）后，该发送不再自动响应**：但手动触发仍可用
5. **触发测试不等价于重新发起原生桥接**：只是直接调用 `window.dispatchEvent`

---

## 数据流示意

```
用户点击切换响应
  ↓
SET_ACTIVE_RESPONSE 命令
  ↓
background/controller.ts 更新 sender.activeResponseId
  ↓
storage.ts 持久化
  ↓
SNAPSHOT 推送到 panel
  ↓
usePanelController 同步 state
  ↓
UI 更新（● 圆点位置变化）
```

---

## 附录：现有命令参考

```typescript
// 发送相关
UPSERT_SENDER: { type: "UPSERT_SENDER"; sender: BridgeSender }
DELETE_SENDER: { type: "DELETE_SENDER"; senderId: string }
DUPLICATE_SENDER: { type: "DUPLICATE_SENDER"; senderId: string }
TOGGLE_SENDER: { type: "TOGGLE_SENDER"; senderId: string; enabled: boolean }

// 响应相关
UPSERT_RESPONSE: { type: "UPSERT_RESPONSE"; senderId: string; response: BridgeResponseOption }
DELETE_RESPONSE: { type: "DELETE_RESPONSE"; senderId: string; responseId: string }
SET_ACTIVE_RESPONSE: { type: "SET_ACTIVE_RESPONSE"; senderId: string; responseId: string | null }
TRIGGER_RESPONSE: { type: "TRIGGER_RESPONSE"; senderId: string; responseId: string }

// 批量操作
IMPORT_SENDERS: { type: "IMPORT_SENDERS"; senders: BridgeSender[]; strategy: ImportStrategy }
```

---

## 下次启动时的命令

```bash
# 1. 阅读本文档
cat .codestable/requirements/bridge-rule-separation-implementation-next.md

# 2. 启动实现
# 建议按步骤逐个实现，每完成一步验证 typecheck 和 build

# 3. 验证
npm run build
# 加载扩展到 Chrome 手动测试
```

---

**状态**：数据层和状态层已完成，UI 层待实现。本文档提供完整的 UI 设计和实现步骤，可直接交给 AI 继续开发。
