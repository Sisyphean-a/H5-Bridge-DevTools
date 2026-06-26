import type { BridgeSender } from "../../../shared/senderTypes";
import type { PanelController } from "../../usePanelController";
import { Badge, EmptyState, PaneHeader, SearchField, StatusDot, ToggleSwitch } from "./RulesShared";

export function MatchesView({ controller }: { controller: PanelController }) {
  return (
    <section className="workspace-pane">
      <PaneHeader title="匹配关系" subtitle={`共 ${controller.filteredMatchSenders.length} 条发送`} />
      <div className="workspace-pane__body">
        <div className="workspace-section">
          <SearchField
            value={controller.state.filterText}
            onChange={(value) =>
              controller.setState((current) => ({ ...current, filterText: value }))
            }
            placeholder="按发送、响应或事件名搜索匹配关系"
          />
        </div>
        <div className="stack">
          {controller.filteredMatchSenders.length === 0 ? (
            <EmptyState
              title="暂无匹配关系"
              description="添加发送和响应后会显示在这里。"
            />
          ) : (
            controller.filteredMatchSenders.map((sender) => (
              <MatchCard key={sender.id} sender={sender} controller={controller} />
            ))
          )}
        </div>
      </div>
    </section>
  );
}

function MatchCard({
  sender,
  controller,
}: {
  sender: BridgeSender;
  controller: PanelController;
}) {
  const hasActive = Boolean(sender.activeResponseId);
  return (
    <article className="match-card">
      <div className="match-card__header">
        <ToggleSwitch
          checked={sender.enabled}
          title={sender.enabled ? "禁用发送" : "启用发送"}
          onChange={(enabled) =>
            controller.postCommand({ type: "TOGGLE_SENDER", senderId: sender.id, enabled })
          }
        />
        <div className="row-card__content">
          <p className="row-card__title">{sender.name}</p>
          <p className="row-card__subtitle mono">{sender.matchEvent || "(空事件名)"}</p>
        </div>
        <Badge tone={hasActive ? "green" : "red"}>
          {hasActive ? "自动配对中" : "无自动响应"}
        </Badge>
        <button
          type="button"
          className="control-button control-button--quiet"
          onClick={() => controller.openSenderTab(sender.id)}
        >
          编辑发送
        </button>
      </div>
      {sender.responses.length === 0 ? (
        <EmptyState
          title="当前没有响应候选"
          description="为该发送添加一个响应。"
          action={
            <button
              type="button"
              className="control-button control-button--primary"
              onClick={() => controller.createResponseForSender(sender.id)}
            >
              添加响应
            </button>
          }
        />
      ) : (
        sender.responses.map((response) => {
          const isActive = sender.activeResponseId === response.id;
          return (
            <div key={response.id} className="match-response">
              <StatusDot active={isActive} />
              <div className="row-card__content">
                <p className="row-card__title">{response.name}</p>
                <p className="row-card__subtitle mono">
                  {response.eventName || "(空事件名)"}
                </p>
              </div>
              <Badge tone="orange">{response.delayMs}ms</Badge>
              <button
                type="button"
                className="control-button control-button--quiet"
                onClick={() => controller.selectResponse(sender.id, response.id)}
              >
                编辑
              </button>
              {!isActive ? (
                <button
                  type="button"
                  className="control-button control-button--primary control-button--quiet"
                  onClick={() => controller.setActiveResponse(sender.id, response.id)}
                >
                  切为活跃
                </button>
              ) : (
                <button
                  type="button"
                  className="control-button control-button--quiet"
                  onClick={() => controller.setActiveResponse(sender.id, null)}
                >
                  关闭配对
                </button>
              )}
            </div>
          );
        })
      )}
    </article>
  );
}
