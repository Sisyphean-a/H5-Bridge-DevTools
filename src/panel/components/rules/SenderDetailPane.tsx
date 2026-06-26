import type { PanelController } from "../../usePanelController";
import { EmptyState, Field, FooterActions, PaneHeader, Badge, StatusDot } from "./RulesShared";

export function SenderDetailPane({
  controller,
  compact = false,
}: {
  controller: PanelController;
  compact?: boolean;
}) {
  const { senderDraft, selectedSender } = controller.state.senderDraft
    ? { senderDraft: controller.state.senderDraft, selectedSender: controller.selectedSender }
    : { senderDraft: null, selectedSender: null };
  if (!senderDraft || !selectedSender) {
    return (
      <section className="workspace-pane">
        <PaneHeader title="发送编辑器" subtitle="选择一条发送进行编辑" />
        <div className="workspace-pane__body">
          <EmptyState
            title="未选择发送"
            description="从左侧列表选择发送。"
          />
        </div>
      </section>
    );
  }

  return (
    <section className="workspace-pane">
      <PaneHeader
        compact={compact}
        title={compact ? senderDraft.name || "发送编辑" : "发送编辑器"}
        subtitle={selectedSender.matchEvent || "(空事件名)"}
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
          <Field label="发送名称">
            <input
              className="control-field"
              value={senderDraft.name}
              onChange={(event) =>
                controller.setState((current) => ({
                  ...current,
                  senderDraft: current.senderDraft
                    ? { ...current.senderDraft, name: event.target.value }
                    : null,
                }))
              }
            />
          </Field>
          <Field label="匹配事件" span2>
            <input
              className="control-field mono"
              value={senderDraft.matchEvent}
              onChange={(event) =>
                controller.setState((current) => ({
                  ...current,
                  senderDraft: current.senderDraft
                    ? { ...current.senderDraft, matchEvent: event.target.value }
                    : null,
                }))
              }
            />
          </Field>
        </div>
        <div className="workspace-section">
          <PaneHeader
            compact
            title={`响应候选 (${selectedSender.responses.length})`}
            subtitle="点击名称进入响应编辑"
            extra={
              <button
                type="button"
                className="control-button control-button--quiet"
                onClick={() => controller.createResponseForSender(selectedSender.id)}
              >
                新增响应
              </button>
            }
          />
          <div className="stack" style={{ marginTop: 12 }}>
            {selectedSender.responses.length === 0 ? (
              <EmptyState
                title="当前没有响应"
                description="添加一个响应候选。"
                action={
                  <button
                    type="button"
                    className="control-button control-button--primary"
                    onClick={() => controller.createResponseForSender(selectedSender.id)}
                  >
                    添加响应
                  </button>
                }
              />
            ) : (
              selectedSender.responses.map((response) => {
                const isActive = selectedSender.activeResponseId === response.id;
                return (
                  <div key={response.id} className="response-option">
                    <button
                      type="button"
                      className="control-button control-button--ghost control-button--quiet"
                      onClick={() => controller.setActiveResponse(selectedSender.id, response.id)}
                    >
                      <StatusDot active={isActive} />
                    </button>
                    <div className="row-card__content">
                      <button
                        type="button"
                        className="link-button"
                        onClick={() => controller.selectResponse(selectedSender.id, response.id)}
                      >
                        {response.name}
                      </button>
                      <p className="row-card__subtitle mono">{response.eventName || "(空事件名)"}</p>
                    </div>
                    <Badge tone={isActive ? "green" : "gray"}>
                      {isActive ? "当前活跃" : "待机响应"}
                    </Badge>
                    <Badge tone="orange">{response.delayMs}ms</Badge>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
      <FooterActions
        primary={
          <>
            <button
              type="button"
              className="control-button control-button--primary"
              onClick={controller.saveSender}
            >
              保存发送
            </button>
            <button type="button" className="control-button" onClick={controller.resetSender}>
              重置草稿
            </button>
            <button type="button" className="control-button" onClick={controller.duplicateSender}>
              复制发送
            </button>
          </>
        }
        danger={
          <button
            type="button"
            className="control-button control-button--danger"
            onClick={() => {
              if (window.confirm(`确认删除发送“${selectedSender.name}”及其全部响应？`)) {
                controller.deleteSender();
              }
            }}
          >
            删除发送
          </button>
        }
      />
    </section>
  );
}
