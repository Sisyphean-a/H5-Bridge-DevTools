import { useEffect, useState } from "react";
import { ResponseImageTools } from "./ResponseImageTools";
import type { PanelController } from "../../usePanelController";
import { Badge, EmptyState, Field, FooterActions, PaneHeader, SearchField, StatusDot } from "./RulesShared";

type ResponseEditorMode = "text" | "image";

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

function ResponseDetailPane({
  controller,
  compact = false,
}: {
  controller: PanelController;
  compact?: boolean;
}) {
  const record = controller.selectedResponseRecord;
  const draft = controller.state.responseDraft;
  const [editorMode, setEditorMode] = useState<ResponseEditorMode>("text");

  useEffect(() => {
    if (!draft) {
      return;
    }
    setEditorMode("text");
  }, [draft?.id]);

  if (!record || !draft) {
    return (
      <section className="workspace-pane">
        <PaneHeader title="响应编辑器" subtitle="选择一条响应进行编辑" />
        <div className="workspace-pane__body">
          <EmptyState
            title="未选择响应"
            description="从左侧列表选择响应。"
          />
        </div>
      </section>
    );
  }

  return (
    <section className="workspace-pane">
      <PaneHeader
        compact={compact}
        title={compact ? draft.name || "响应编辑" : "响应编辑器"}
        subtitle={record.sender.name}
        extra={
          compact ? (
            <button
              type="button"
              className="control-button control-button--ghost control-button--quiet"
              onClick={() =>
                controller.setState((current) => ({ ...current, narrowDetailOpen: false }))
              }
            >
              返回列表
            </button>
          ) : null
        }
      />
      <div className="workspace-pane__body">
        <div className="form-grid workspace-section">
          <Field label="响应名称">
            <input
              className="control-field"
              value={draft.name}
              onChange={(event) =>
                controller.setState((current) => ({
                  ...current,
                  responseDraft: current.responseDraft
                    ? { ...current.responseDraft, name: event.target.value }
                    : null,
                }))
              }
            />
          </Field>
          <Field label="所属发送">
            <button
              type="button"
              className="link-button"
              onClick={() => controller.openSenderTab(record.sender.id)}
            >
              {record.sender.name}
            </button>
          </Field>
          <Field label="延迟 (ms)">
            <input
              className="control-field mono"
              value={draft.delayMs}
              onChange={(event) =>
                controller.setState((current) => ({
                  ...current,
                  responseDraft: current.responseDraft
                    ? { ...current.responseDraft, delayMs: event.target.value }
                    : null,
                }))
              }
            />
          </Field>
          <Field label="活跃状态">
            <button
              type="button"
              className="control-button"
              onClick={() => controller.setActiveResponse(record.sender.id, record.response.id)}
            >
              {record.isActive ? "当前为活跃响应" : "切为活跃响应"}
            </button>
          </Field>
          <Field label="事件名称" span2>
            <input
              className="control-field mono"
              value={draft.eventName}
              onChange={(event) =>
                controller.setState((current) => ({
                  ...current,
                  responseDraft: current.responseDraft
                    ? { ...current.responseDraft, eventName: event.target.value }
                    : null,
                }))
              }
            />
          </Field>
          <Field label="编辑模式" span2>
            <select
              className="control-select"
              value={editorMode}
              onChange={(event) => setEditorMode(event.target.value as ResponseEditorMode)}
            >
              <option value="text">文字模式</option>
              <option value="image">图片模式</option>
            </select>
          </Field>
        </div>
        {editorMode === "image" ? (
          <ResponseImageTools controller={controller} />
        ) : (
          <div className="workspace-section">
            <div className="form-grid">
              <Field label="Detail JSON" span2>
                <textarea
                  spellCheck={false}
                  className="control-textarea mono"
                  value={draft.detailText}
                  onChange={(event) =>
                    controller.setState((current) => ({
                      ...current,
                      responseDraft: current.responseDraft
                        ? { ...current.responseDraft, detailText: event.target.value }
                        : null,
                    }))
                  }
                />
              </Field>
            </div>
          </div>
        )}
      </div>
      <FooterActions
        primary={
          <>
            <button
              type="button"
              className="control-button control-button--primary"
              onClick={controller.saveResponse}
            >
              保存响应
            </button>
            <button
              type="button"
              className="control-button control-button--success"
              onClick={controller.triggerSelectedResponse}
            >
              触发测试
            </button>
            <button
              type="button"
              className="control-button"
              onClick={controller.formatCurrentResponseJson}
            >
              格式化 JSON
            </button>
            <button type="button" className="control-button" onClick={controller.resetResponse}>
              重置草稿
            </button>
          </>
        }
        danger={
          <button
            type="button"
            className="control-button control-button--danger"
            onClick={() => {
              if (window.confirm(`确认删除响应“${record.response.name}”？`)) {
                controller.deleteResponse();
              }
            }}
          >
            删除响应
          </button>
        }
      />
    </section>
  );
}
