import { useEffect, useState } from "react";
import type { BridgeSender } from "../../../shared/senderTypes";
import {
  STANDALONE_RESPONSE_TARGET_LABEL,
  STANDALONE_SENDER_ID,
  isVisibleSender,
} from "../../../shared/standaloneSender";
import { ResponseDetailPane } from "./ResponseDetailPane";
import type { PanelController } from "../../usePanelController";
import { Badge, EmptyState, PaneHeader, SearchField, StatusDot } from "./RulesShared";

export function ResponsesView({
  controller,
  isWide,
}: {
  controller: PanelController;
  isWide: boolean;
}) {
  const showDetail = isWide || controller.state.narrowDetailOpen;
  if (!isWide && showDetail && controller.state.responseDraft) {
    return <ResponseDetailPane controller={controller} compact />;
  }

  return (
    <div className={`split-view${isWide ? "" : " split-view--stack"}`}>
      <div className="split-pane split-pane--list">
        <ResponsesListPane controller={controller} />
      </div>
      {isWide ? (
        <div className="split-pane split-pane--detail">
          <ResponseDetailPane controller={controller} />
        </div>
      ) : null}
    </div>
  );
}

function ResponsesListPane({ controller }: { controller: PanelController }) {
  const candidateSenders = (controller.state.snapshot?.senders ?? []).filter(isVisibleSender);
  const [targetSenderId, setTargetSenderId] = useState(() =>
    getDefaultTargetSenderId(controller.state.selectedSenderId, candidateSenders),
  );

  useEffect(() => {
    if (canTargetSender(targetSenderId, candidateSenders)) {
      return;
    }
    setTargetSenderId(getDefaultTargetSenderId(controller.state.selectedSenderId, candidateSenders));
  }, [candidateSenders, controller.state.selectedSenderId, targetSenderId]);

  return (
    <section className="workspace-pane">
      <PaneHeader
        title="安卓 -> H5"
        subtitle={`共 ${controller.responseCount} 条安卓发送`}
      />
      <div className="workspace-pane__body is-list">
        <div className="stack workspace-section">
          <div className="search-row">
            <SearchField
              value={controller.state.filterText}
              onChange={(value) =>
                controller.setState((current) => ({ ...current, filterText: value }))
              }
              placeholder="按消息名、归属或事件名搜索"
            />
            <button
              type="button"
              className="control-button control-button--primary"
              onClick={() => controller.createResponseForSender(targetSenderId)}
            >
              新建
            </button>
          </div>
          <ResponseTargetSelect
            targetSenderId={targetSenderId}
            candidateSenders={candidateSenders}
            onChange={setTargetSenderId}
          />
        </div>
        <div className="stack">
          {controller.filteredResponses.length === 0 ? (
            <EmptyState
              title="暂无安卓发送"
              description="可新建挂载发送，或创建独立安卓发送。"
            />
          ) : (
            controller.filteredResponses.map((record) => {
              const isSelected =
                controller.state.selectedResponse?.senderId === record.sender.id &&
                controller.state.selectedResponse.responseId === record.response.id;
              return (
                <button
                  key={`${record.sender.id}:${record.response.id}`}
                  type="button"
                  className={`row-card${isSelected ? " is-selected" : ""}`}
                  onClick={() =>
                    controller.selectResponse(record.sender.id, record.response.id)
                  }
                >
                  <div className="row-card__top">
                    {record.isStandalone ? (
                      <Badge tone="blue">独立</Badge>
                    ) : (
                      <StatusDot active={record.isActive} />
                    )}
                    <div className="row-card__content">
                      <p className="row-card__title">{record.response.name}</p>
                      <p className="row-card__subtitle">{record.ownerLabel}</p>
                      <p className="row-card__subtitle mono">
                        {record.response.eventName || "(空事件名)"}
                      </p>
                    </div>
                    <div className="row-card__aside">
                      {record.isActive && !record.isStandalone ? <Badge tone="green">自动回传</Badge> : null}
                      <Badge tone="orange">{record.response.delayMs}ms</Badge>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
}

function ResponseTargetSelect({
  targetSenderId,
  candidateSenders,
  onChange,
}: {
  targetSenderId: string;
  candidateSenders: BridgeSender[];
  onChange: (value: string) => void;
}) {
  return (
    <select
      className="control-select"
      value={targetSenderId}
      onChange={(event) => onChange(event.target.value)}
    >
      <option value={STANDALONE_SENDER_ID}>{STANDALONE_RESPONSE_TARGET_LABEL}</option>
      {candidateSenders.map((sender) => (
        <option key={sender.id} value={sender.id}>
          挂载到: {sender.name}
        </option>
      ))}
    </select>
  );
}

function getDefaultTargetSenderId(
  selectedSenderId: string | null,
  candidateSenders: BridgeSender[],
): string {
  return candidateSenders.some((sender) => sender.id === selectedSenderId)
    ? selectedSenderId!
    : STANDALONE_SENDER_ID;
}

function canTargetSender(
  senderId: string,
  candidateSenders: BridgeSender[],
): boolean {
  return senderId === STANDALONE_SENDER_ID || candidateSenders.some((sender) => sender.id === senderId);
}
