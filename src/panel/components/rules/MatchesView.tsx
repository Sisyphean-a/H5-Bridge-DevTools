import type { BridgeResponseOption, BridgeSender } from "../../../shared/senderTypes";
import type { PanelController } from "../../usePanelController";
import { Badge, EmptyState, PaneHeader, SearchField, StatusDot } from "./RulesShared";

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
  const activeResponse = sender.responses.find((response) => response.id === sender.activeResponseId) ?? null;
  return (
    <article className="match-card">
      <SenderSummary sender={sender} controller={controller} hasActive={Boolean(activeResponse)} />
      <div className="match-card__responses">
        {sender.responses.length === 0 ? (
          <EmptyResponses senderId={sender.id} controller={controller} />
        ) : (
          sender.responses.map((response) => (
            <MatchResponseRow
              key={response.id}
              senderId={sender.id}
              response={response}
              isActive={activeResponse?.id === response.id}
              controller={controller}
            />
          ))
        )}
      </div>
    </article>
  );
}

function SenderSummary({
  sender,
  controller,
  hasActive,
}: {
  sender: BridgeSender;
  controller: PanelController;
  hasActive: boolean;
}) {
  return (
    <div className="match-card__sender">
      <div className="match-card__sender-meta">
        <p className="row-card__title">{sender.name}</p>
        <p className="row-card__subtitle mono">{sender.matchEvent || "(空事件名)"}</p>
      </div>
      {hasActive ? (
        <button
          type="button"
          className="control-button control-button--ghost control-button--quiet match-card__sender-action"
          onClick={() => controller.setActiveResponse(sender.id, null)}
        >
          关闭配对
        </button>
      ) : null}
    </div>
  );
}

function EmptyResponses({
  senderId,
  controller,
}: {
  senderId: string;
  controller: PanelController;
}) {
  return (
    <div className="match-card__empty">
      <span className="row-card__subtitle">暂无响应候选</span>
      <button
        type="button"
        className="control-button control-button--primary control-button--quiet"
        onClick={() => controller.createResponseForSender(senderId)}
      >
        添加响应
      </button>
    </div>
  );
}

function MatchResponseRow({
  senderId,
  response,
  isActive,
  controller,
}: {
  senderId: string;
  response: BridgeResponseOption;
  isActive: boolean;
  controller: PanelController;
}) {
  return (
    <div className="match-response">
      <StatusDot active={isActive} />
      <div className="row-card__content">
        <p className="row-card__title">{response.name}</p>
        <p className="row-card__subtitle mono">{response.eventName || "(空事件名)"}</p>
      </div>
      <Badge tone="orange">{response.delayMs}ms</Badge>
      <button
        type="button"
        className="control-button control-button--quiet"
        onClick={() => controller.selectResponse(senderId, response.id)}
      >
        编辑
      </button>
      {!isActive ? (
        <button
          type="button"
          className="control-button control-button--primary control-button--quiet"
          onClick={() => controller.setActiveResponse(senderId, response.id)}
        >
          切为活跃
        </button>
      ) : null}
    </div>
  );
}
