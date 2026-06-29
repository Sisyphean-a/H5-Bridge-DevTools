import type { BridgeResponseOption, BridgeSender } from "../../../shared/senderTypes";
import { getRestorableResponseId } from "../../../shared/rules";
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
        <div className="stack match-list">
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
  const restorableResponseId = getRestorableResponseId(sender);
  const canSwitchBetweenResponses = sender.responses.length > 1;
  return (
    <article className="match-card">
      <SenderSummary
        sender={sender}
        controller={controller}
        activeResponseId={activeResponse?.id ?? null}
        restorableResponseId={restorableResponseId}
      />
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
              showActivateButton={canSwitchBetweenResponses}
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
  activeResponseId,
  restorableResponseId,
}: {
  sender: BridgeSender;
  controller: PanelController;
  activeResponseId: string | null;
  restorableResponseId: string | null;
}) {
  const content = (
    <div className="match-card__sender-meta">
      <p className="row-card__title">{sender.name}</p>
      <p className="row-card__subtitle mono">{sender.matchEvent || "(空事件名)"}</p>
    </div>
  );

  if (activeResponseId) {
    return (
      <button
        type="button"
        className="match-card__sender is-active"
        onClick={() => controller.setActiveResponse(sender.id, null)}
        title="点击关闭配对"
      >
        {content}
      </button>
    );
  }

  if (!restorableResponseId) {
    return (
      <div className="match-card__sender" aria-disabled="true">
        {content}
      </div>
    );
  }

  return (
    <button
      type="button"
      className="match-card__sender is-restorable"
      onClick={() => controller.setActiveResponse(sender.id, restorableResponseId)}
      title="点击恢复上次配对"
    >
      {content}
    </button>
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
  showActivateButton,
  controller,
}: {
  senderId: string;
  response: BridgeResponseOption;
  isActive: boolean;
  showActivateButton: boolean;
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
      {showActivateButton && !isActive ? (
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
