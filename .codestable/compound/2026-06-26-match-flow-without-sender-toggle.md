# 背景

2026-06-26 这次规则面板改造里，原先每个 sender 的单独“启用/禁用”开关被确认没有独立价值，因为它控制的是“是否参与自动匹配”，而不是“是否允许发送桥接调用”。用户更希望把这层语义收敛到“是否存在活跃响应”，并把匹配页作为默认入口。同时在调整匹配页布局时暴露出一个真实问题：panel 还会向已经断开的 `chrome.runtime.Port` 发消息，导致点击“切为活跃”时报 `Attempting to use a disconnected port object`，看起来像切换失效。

# 结论

后续理解这块逻辑时，统一按下面的规则看：

- sender 不再维护独立的 `enabled` 状态；是否参与自动匹配，只看 `activeResponseId` 是否指向当前 sender 的有效响应。
- “关闭匹配”不再等价于禁用 sender，而是把 `activeResponseId` 设为 `null`。
- 规则区默认子 tab 是“匹配”，高频操作优先从匹配页进入。
- panel 侧端口必须容忍 devtools/panel 生命周期抖动；断开后需要自动重连，不能继续持有旧 port 引用发命令。

# 证据

- 匹配逻辑已经改成靠活跃响应判断，见 `src/shared/rules.ts` 的 `findMatchingSender`。
- sender 数据结构已移除 `enabled`，见 `src/shared/senderTypes.ts`；对应 panel 命令里也已移除 `TOGGLE_SENDER`，见 `src/shared/messageTypes.ts`。
- 匹配页现在承担主入口，子 tab 顺序与默认值改在 `src/panel/components/RuleWorkspace.tsx`、`src/panel/usePanelController.ts`。
- panel 断线重连逻辑在 `src/panel/usePanelController.ts` 的 `usePanelConnection`，断开时会清空 `portRef` 并 `setTimeout(connect, 60)` 重新连。
- 兼容旧数据时，历史 `enabled=false` 会折算成 `activeResponseId=null`，见 `src/shared/storage.ts` 和 `src/shared/migrate.ts`。
- 本次改造已用 `npm run typecheck`、`npm run test` 验证通过。
