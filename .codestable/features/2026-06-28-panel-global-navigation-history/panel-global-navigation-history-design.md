---
doc_type: feature-design
feature: 2026-06-28-panel-global-navigation-history
requirement: bridge-rule-separation
status: approved
summary: 为 DevTools 面板增加全局路由历史，让鼠标侧键按真实跳转路径返回上一视图
tags: [panel, navigation, back, routing]
---

# panel-global-navigation-history design

## 0. 术语约定

| 术语 | 定义 | 防冲突结论 |
| --- | --- | --- |
| 路由快照 | 能唯一描述当前面板“看见的是哪一页”的轻量状态，只包含 tab / 子 tab / 详情目标 id，不包含草稿文本、筛选词、hover 之类局部 UI 状态 | 代码里现有 `activeTab` / `rulesSubTab` / `narrowDetailOpen` 只是渲染状态碎片；本 feature 里“路由”指它们的统一抽象，不等于浏览器 URL |
| 历史栈 | 当前页之前可回退的路由快照序列，只支持向后回退，不支持前进 | 避免和日志、桥接消息队列混淆；它只服务 panel UI 导航 |
| 跳页 | 用户从当前视图切到另一个视图，返回后希望回到原入口的导航动作，例如“日志 -> 创建规则 -> 响应详情”、“匹配 -> 编辑响应 -> 响应详情” | 与“就地编辑”区分；只有跳页才进入历史 |
| 就地聚焦 | 仍停留在同一类页面，只是把当前选中的 sender / response 换成另一个对象 | 防止每次切换详情都堆一条历史，导致侧键返回噪声过大 |

## 1. 决策与约束

### 需求摘要

- 做什么：给 DevTools panel 增加统一的全局路由历史；鼠标侧键后退时，面板按真实跳转路径返回上一视图，而不是只在局部把 `narrowDetailOpen` 置回 `false`
- 为谁：在规则、匹配、日志、手动发送、设置之间来回切换，并会从一个页面跳到另一个页面继续编辑规则的调试用户
- 成功标准：
  - 顶层 tab、规则子 tab、窄屏详情页、以及跨页动作入口都走同一套路由层
  - 从匹配页或日志页跳到响应/发送编辑后，侧键返回能回到原入口，而不是总落到固定列表页
  - 历史里引用的 sender / response 被删除后，回退不会报错，会降级到最近的可用列表页或继续弹出上一条有效历史
  - 鼠标侧键在可编辑输入框、文本域、下拉框内不抢占事件，避免影响输入体验
- 明确不做：
  - 不引入浏览器 URL、深链接、书签、forward 栈、面包屑或可视化返回按钮
  - 不把搜索词、hover、日志展开行等组件私有 UI 状态并入路由历史
  - 不跨 panel 重载 / DevTools 关闭重开持久化历史栈
  - 不改桥接拦截、规则匹配、日志采集等运行时逻辑，只改 panel 导航

### 复杂度档位

- 结构 = modules（偏离默认 functions 的原因：导航语义会被 `App`、`Toolbar`、`RuleWorkspace`、`senderActions`、`responseActions`、`helpers` 共同消费，继续散写在现有文件里会把“连接管理”和“导航编排”混到一起）
- 可测试性 = tested（偏离默认 testable 的原因：路由历史和失效回退属于纯状态机，必须用单测锁死 push / replace / back / normalize 语义，避免后续交互回归）
- 其余维度走“项目内部工具”默认档位，无偏离

### 关键决策

1. 用显式 `PanelRoute` + `history` 建模当前页面，而不是继续让组件直接写 `activeTab` / `rulesSubTab` / `narrowDetailOpen`
   - 原因：现在“日志 -> 创建规则”“匹配 -> 编辑响应”“响应详情 -> 返回列表”走的是三套互不关联的状态写法，侧键返回没有统一的目标可回放
2. 历史只支持 `push / replace / back` 三种语义，不做 forward
   - `push`：从一个页面跳到另一个页面，返回时需要恢复来源
   - `replace`：仍在同类详情页里切换对象，例如在响应详情里改选另一条响应，不额外加历史
   - `back`：弹出历史直到拿到一条当前快照下仍有效的路由；没有有效历史则 no-op
3. 路由快照只描述“页面”，不描述表单草稿和筛选细节
   - 原因：这些状态已有自己归属，强行塞进历史会让路由对象膨胀，也会把“返回上一页”变成“回滚整个页面状态”
4. 路由失效时按“详情 -> 对应列表 -> 更早历史”降级
   - sender 丢失：`rules.senders.detail` 降级为 `rules.senders.list`
   - response 丢失：`rules.responses.detail` 降级为 `rules.responses.list`
   - 若当前历史顶端本身已失效，继续向后弹，直到遇到第一条有效项
5. 鼠标侧键监听放在 panel 根容器统一处理
   - 原因：当前响应/发送详情页的后退逻辑散在局部按钮里；全局监听才能覆盖“日志 -> 规则”“匹配 -> 响应”等跨页面跳转

### 前置依赖

- 无外部依赖；实现前先跑 `npm run typecheck`、`npm run test`、`npm run build` 作为基线预检，确认现有 panel 状态流是绿的

## 2. 名词与编排

### 2.1 名词层

#### 现状

- 面板可见页面由 `AppViewState.activeTab`、`AppViewState.rulesSubTab`、`AppViewState.narrowDetailOpen` 三个分散字段描述，见 `src/panel/types.ts:38-52`
- sender / response 的当前编辑对象通过 `selectedSenderId`、`selectedResponse`、`senderDraft`、`responseDraft` 保存，见 `src/panel/types.ts:38-52`
- 规则页跳转 helpers 在 `src/panel/selectionState.ts:5-49`，它们会直接把 `activeTab`、`rulesSubTab`、`selectedResponse`、`narrowDetailOpen` 一次性写进 state
- 顶层 tab 在 `src/panel/App.tsx:47-67` 里直接 `setState({ activeTab })`；规则子 tab 在 `src/panel/components/RuleWorkspace.tsx:23-37` 里直接写 `rulesSubTab` 并清 `narrowDetailOpen`
- 详情页“返回列表”按钮只会把 `narrowDetailOpen` 改成 `false`，见 `src/panel/components/rules/SenderDetailPane.tsx:35-44`、`src/panel/components/rules/ResponsesView.tsx:158-167`

#### 变化

1. 新增 `PanelRoute`
   - 负责统一表达当前页，不再让组件自己拼 tab/subtab/detail
   - 候选形态：

```ts
type PanelRoute =
  | { tab: "logs" }
  | { tab: "manual" }
  | { tab: "settings" }
  | { tab: "rules"; rulesSubTab: "matches" }
  | { tab: "rules"; rulesSubTab: "senders"; detail: "list" }
  | { tab: "rules"; rulesSubTab: "senders"; detail: "detail"; senderId: string }
  | { tab: "rules"; rulesSubTab: "responses"; detail: "list" }
  | {
      tab: "rules";
      rulesSubTab: "responses";
      detail: "detail";
      senderId: string;
      responseId: string;
    };
// 来源：src/panel/types.ts AppViewState + src/panel/selectionState.ts openSenderState/openResponseState
```

2. 新增 `PanelNavigationState`
   - 保存 `current` 与 `history`
   - `history` 只存先前路由快照，不存整份 `AppViewState`

```ts
interface PanelNavigationState {
  current: PanelRoute;
  history: PanelRoute[];
}
// 来源：src/panel/App.tsx 顶层 tab 切换 + src/panel/components/RuleWorkspace.tsx 子 tab 切换
```

3. 现有 `activeTab` / `rulesSubTab` / `narrowDetailOpen` 退化为“由路由投影出来的渲染字段”
   - 现阶段保留它们，避免一次性重写全部渲染分支
   - 但只有导航模块能写这些字段；组件不再直接 `setState`
4. sender / response 选中状态继续存在，但由“应用路由”统一更新
   - `rules.senders.detail(senderId)` 会同步选中 sender 并创建/恢复 senderDraft
   - `rules.responses.detail(senderId, responseId)` 会同步选中 sender、response，并创建/恢复 responseDraft
   - 这样历史回退和业务动作走的是同一套状态入口

### 2.2 编排层

```mermaid
flowchart LR
  A[UI 导航意图\nToolbar / RuleWorkspace / Logs / Matches / 详情返回 / 鼠标侧键] --> B[navigation reducer\npush / replace / back]
  B --> C[normalizeRoute(snapshot, route)]
  C --> D[applyRouteToState]
  D --> E[更新 activeTab / rulesSubTab / narrowDetailOpen / selected ids / drafts]
  E --> F[Panel 重新渲染]
  G[SNAPSHOT 更新 / 删除 sender,response] --> C
```

#### 现状

- 导航拓扑是“组件各自写局部状态”
  - 顶层 tab：`Toolbar -> App.setState(activeTab)`，见 `src/panel/App.tsx:47-67`
  - 规则子 tab：`RuleWorkspace -> setState(rulesSubTab, narrowDetailOpen=false)`，见 `src/panel/components/RuleWorkspace.tsx:23-37`
  - 匹配页编辑响应：`MatchesView -> controller.selectResponse(...)`，再走 `openResponseState(...)` 把页面切到 `rules/responses/detail`，见 `src/panel/components/rules/MatchesView.tsx:168-183`、`src/panel/responseActions.ts:12-24`
  - 日志页创建规则：`LogsPanel -> controller.createSenderFromLog(...)`，再走 `openResponseState(...)` 切页，见 `src/panel/components/LogsPanel.tsx:301-307`、`src/panel/senderActions.ts:114-132`
  - 返回：局部按钮只关心窄屏详情开关，不知道来源页
- `syncSnapshotState` 只负责草稿与远端快照同步，见 `src/panel/helpers.ts:5-21`；它不会修复“当前页引用的 sender / response 已失效”的导航问题

#### 变化

1. 所有“切页”动作统一先生成导航意图，再由 reducer 决定 `push / replace / back`
   - `Toolbar` 顶层切 tab：`push`
   - `RuleWorkspace` 切规则子 tab：`push`
   - 从匹配页/日志页跳到详情：`push`
   - 在同类详情页里切换另一条 sender/response：`replace`
   - 详情里的返回按钮、鼠标侧键：`back`
2. `applyRouteToState` 成为唯一能写这几个渲染字段的入口：
   - `activeTab`
   - `rulesSubTab`
   - `narrowDetailOpen`
   - `selectedSenderId`
   - `selectedResponse`
   - 必要时刷新 `senderDraft` / `responseDraft`
3. `syncSnapshotState` 在同步草稿后追加 `normalizeNavigationState`
   - 当前路由失效：降级到最近可用页
   - 历史路由失效：保留顺序，但在 `back` 时跳过无效项；若实现更简单，也可在同步时直接清洗掉失效项
4. 全局鼠标侧键监听从 panel 根容器发起 `back`
   - 条件：
     - `event.button === 3`
     - 当前目标不是 `input` / `textarea` / `select` / `contenteditable`
     - 历史栈非空
   - 满足条件时 `preventDefault + stopPropagation`，避免事件落到组件局部各写一套

#### 流程级约束

- 历史是内存态，panel 断开重连、快照更新不清空；只有 panel remount 才回到初始路由
- `replace` 只允许替换当前路由，不修改历史前缀，防止“同页切换 5 次对象”生成 5 条回退
- 路由应用必须幂等：重复应用同一条路由，不应改坏当前草稿或多推一条历史
- 失效回退必须显式可观测：被删除的响应不能让 `back` 静默报错或卡死，最终 UI 必须停在一个可渲染页
- 不新增调试日志或吞错兜底；导航异常通过测试暴露，运行时只做合法降级

### 2.3 挂载点清单

- Panel 根容器：`src/panel/App.tsx` — 修改，挂入全局鼠标侧键返回入口
- 顶层路由入口：`src/panel/components/Toolbar.tsx` — 修改，顶层 tab 切换改走统一导航层
- 规则子路由入口：`src/panel/components/RuleWorkspace.tsx` — 修改，规则子 tab 切换改走统一导航层
- 跨页动作入口：`src/panel/components/LogsPanel.tsx`、`src/panel/components/rules/MatchesView.tsx` — 修改，从日志/匹配跳到规则详情时压入历史
- 详情返回入口：`src/panel/components/rules/SenderDetailPane.tsx`、`src/panel/components/rules/ResponsesView.tsx` — 修改，返回动作统一改为 `back`，不再硬编码“返回列表”

### 2.4 推进策略

1. 微重构骨架：把 panel 路由状态和纯状态迁移 helper 抽到独立模块，先保证现有 tab / detail 切换语义能通过 helper 表达
   - 退出信号：新增导航 helper 后，现有 `typecheck` / `test` / `build` 全绿，未引入行为变化
2. 顶层与规则子路由接入：`Toolbar`、`RuleWorkspace` 统一改走 `push` 导航
   - 退出信号：顶层 tab 与 rules 子 tab 的切换都不再出现组件内联 `setState` 改路由字段
3. 详情与跨页动作接入：sender / response / logs / matches 的跳页统一改走 `push / replace`
   - 退出信号：从日志/匹配/列表跳到详情后，当前路由和历史栈都能准确反映来源页
4. 快照同步与删除回退：把路由规范化接进 `syncSnapshotState` 和删除动作
   - 退出信号：sender / response 删除后，当前页与历史回退都只会落在可用页面
5. 全局返回验证：在根容器接入鼠标侧键回退，并补齐单测与手工验证
   - 退出信号：小屏详情返回、跨页返回、无历史 no-op、可编辑控件忽略侧键四类场景都有可观察证据

### 2.5 结构健康度与微重构

#### 评估

- 文件级 — `src/panel/usePanelController.ts`：当前约 293 行，已同时承担连接管理、派生 selector、action wiring；再把全局路由 reducer 和历史清洗逻辑塞进去，会直接把“连接生命周期”和“导航编排”混成一个文件
- 文件级 — `src/panel/selectionState.ts`：当前规模小，但已经是 sender/response 详情状态的纯变换入口，适合继续承接“由路由投影到 state”的纯函数逻辑
- 文件级 — `src/panel/App.tsx`：只应保留根容器装配、布局切换和全局监听；不适合下沉复杂路由演算
- 目录级 — `src/panel/`：同层文件已较多，但本次只新增 1 个导航 concern 模块，暂时没有稳定命名前缀或批量子目录迁移信号

#### 结论：微重构（拆文件）

#### 方案

- 搬什么：
  - 把“当前页是什么、如何 push / replace / back、如何把路由应用到 `AppViewState`、如何在快照更新后清洗失效路由”集中到新模块
  - 保留 `usePanelController.ts` 只做 state owner、连接和 action 注入
- 搬到哪：
  - 新建 `src/panel/navigationState.ts`（纯状态与 helper）
  - 继续保留 `selectionState.ts` 处理 sender/response draft 构造，但由 `navigationState.ts` 统一编排调用
- 行为不变怎么验证：
  - 微重构阶段先只把现有切页语义搬过去，不改功能
  - `npm run typecheck`、`npm run test`、`npm run build` 全绿
  - 相关 diff 只表现为调用入口从内联状态写法改到 helper
- 步骤序列（provable refactor）：
  1. 建立导航纯函数模块，复制当前路由字段的既有语义
  2. 把 `App` / `RuleWorkspace` / actions 的现有切页入口换成调用该模块
  3. 运行类型检查、测试、构建，确认此时仍不包含历史功能变化

## 3. 验收契约

### 关键场景清单

1. 小屏发送列表 -> 点击一条发送 -> 进入发送详情；按鼠标侧键后退 -> 回到发送列表，不报错，列表仍可继续操作
   - 证据类型：单测 + 手工
2. 匹配页 -> 点击某条响应的“编辑” -> 进入响应详情；按鼠标侧键后退 -> 回到匹配页，而不是落到响应列表
   - 证据类型：单测 + 手工
3. 日志页 -> 对某条日志点击“创建规则” -> 跳到规则页的发送/响应详情；按鼠标侧键后退 -> 回到日志页
   - 证据类型：单测 + 手工
4. 在响应详情页里切换到另一条响应后，再按一次鼠标侧键 -> 回到来源页，而不是在多条响应详情之间逐条倒退
   - 证据类型：单测
5. 当前页或历史页引用的 response 被删除后，继续按鼠标侧键后退 -> 面板停在最近的可用列表页或更早历史页，不出现空白页、异常 toast 或报错
   - 证据类型：单测
6. 在输入框 / 文本域 / 下拉框内触发鼠标侧键 -> 不拦截事件，不意外切页
   - 证据类型：单测 + 手工
7. 没有历史时触发鼠标侧键 -> 当前页面保持不变，无额外状态抖动
   - 证据类型：单测
8. 顶层 tab 与规则子 tab 切换后，继续用鼠标侧键可以按进入顺序逐级回退
   - 证据类型：单测 + 手工

### 明确不做的反向核对项

- 代码中不应出现新的 browser URL / hash / query 路由拼装逻辑
- 代码中不应新增 forward 栈、面包屑 UI 或新的可见返回按钮
- 路由历史对象中不应存放 `filterText`、日志展开集合、hover 状态、草稿文本等局部 UI 数据
- 本次 diff 不应修改 `src/content`、`src/background`、`src/shared/rules.ts` 里的桥接运行时匹配逻辑

### Top 3 风险

1. 同类详情切换如果误用 `push`，历史会塞满“响应 A -> 响应 B -> 响应 C”
   - 缓解：把“同 route class 改目标 id”定义成 `replace`，并加单测覆盖
2. 快照同步或删除动作没清洗历史，会让 `back` 指向已不存在的 sender/response
   - 缓解：在 `syncSnapshotState` 与删除动作后统一走 route normalize，验收场景单独覆盖删除后的回退
3. 全局侧键监听如果不排除可编辑元素，会在输入 JSON 时误切页
   - 缓解：沿用旧实现的 editable target 判定，并加输入控件场景测试

### 非显然依赖

- sender / response 的恢复依赖 `createSenderDraft`、`createResponseDraft` 当前行为稳定；若这些 helper 改语义，路由应用会一起受影响
- 日志页的搜索、展开状态目前是组件私有 state；本 feature 只保证能回到日志页，不额外承诺恢复这些局部 UI 细节

### 关键假设

- 假设：用户要求的“跳回来”以页面级返回为主，不要求恢复日志页内每条展开状态这类组件私有细节
- 假设：当前 panel 只需要“后退”，不需要“前进”或可见导航条
- 假设：详情页返回在宽屏和窄屏都接受“回到来源页或对应列表页”的统一语义，而不是继续保留宽屏特有的局部清空选中逻辑

### 必跑验证命令

- 预检：`npm run typecheck`
- 预检：`npm run test`
- 交付前：`npm run build`
- 手工验证：在 DevTools panel 实际触发“日志 -> 创建规则”“匹配 -> 编辑响应”“发送/响应详情 -> 侧键返回”

### 交付物清单

- panel 路由状态模块
- `usePanelController` 暴露的导航入口
- 顶层 tab / rules 子 tab / 跨页动作 / 详情返回的接线路径
- 全局鼠标侧键返回监听
- 覆盖 push / replace / back / invalid-route normalize 的测试

### 清洁度规则

- 不允许新增调试日志、临时 TODO/FIXME、注释掉的旧导航代码、未使用 import
- 不允许再出现新的“组件内联 `setState` 直接改 `activeTab` / `rulesSubTab` / `narrowDetailOpen`”路径

## 4. 与项目级架构文档的关系

- 本 feature 改动局限在 `src/panel` 内部，不引入新的桥接协议、存储结构或跨子系统契约
- acceptance 阶段若确认“panel 路由状态统一由导航模块维护”会成为长期约束，可考虑把这条规则补进 `architecture/ARCHITECTURE.md` 的 panel 章节；否则本轮可不回写架构文档
