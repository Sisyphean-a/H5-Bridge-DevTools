import { useEffect, useState } from "react";
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
  const [targetSenderId, setTargetSenderId] = useState(controller.state.selectedSenderId ?? "");
  const candidateSenders = controller.state.snapshot?.senders ?? [];

  useEffect(() => {
    if (candidateSenders.some((sender) => sender.id === targetSenderId)) {
      return;
    }
    setTargetSenderId(controller.state.selectedSenderId ?? candidateSenders[0]?.id ?? "");
  }, [candidateSenders, controller.state.selectedSenderId, targetSenderId]);

  return (
    <section className="workspace-pane">
      <PaneHeader
        title="响应列表"
        subtitle={`共 ${controller.responseCount} 个响应`}
      />
      <div className="workspace-pane__body is-list">
        <div className="stack workspace-section">
          <div className="search-row">
            <SearchField
              value={controller.state.filterText}
              onChange={(value) =>
                controller.setState((current) => ({ ...current, filterText: value }))
              }
              placeholder="按响应名、发送名或事件名搜索"
            />
            <button
              type="button"
              className="control-button control-button--primary"
              onClick={() => controller.createResponseForSender(targetSenderId)}
              disabled={!targetSenderId}
            >
              新建
            </button>
          </div>
          <select
            className="control-select"
            value={targetSenderId}
            onChange={(event) => setTargetSenderId(event.target.value)}
          >
            {candidateSenders.length === 0 ? (
              <option value="">暂无发送可挂载</option>
            ) : (
              candidateSenders.map((sender) => (
                <option key={sender.id} value={sender.id}>
                  添加到: {sender.name}
                </option>
              ))
            )}
          </select>
        </div>
        <div className="stack">
          {controller.filteredResponses.length === 0 ? (
            <EmptyState
              title="暂无响应"
              description="选择发送后可新建响应。"
            />
          ) : (
            controller.filteredResponses.map((record) => {
              const isSelected =
                controller.state.selectedResponse?.responseId === record.response.id;
              return (
                <button
                  key={record.response.id}
                  type="button"
                  className={`row-card${isSelected ? " is-selected" : ""}`}
                  onClick={() =>
                    controller.selectResponse(record.sender.id, record.response.id)
                  }
                >
                  <div className="row-card__top">
                    <StatusDot active={record.isActive} />
                    <div className="row-card__content">
                      <p className="row-card__title">{record.response.name}</p>
                      <p className="row-card__subtitle">{record.sender.name}</p>
                      <p className="row-card__subtitle mono">
                        {record.response.eventName || "(空事件名)"}
                      </p>
                    </div>
                    <div className="row-card__aside">
                      {record.isActive ? <Badge tone="green">活跃</Badge> : null}
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
