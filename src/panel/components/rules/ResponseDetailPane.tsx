import type { PanelController } from "../../usePanelController";
import {
  STANDALONE_RESPONSE_TARGET_LABEL,
  getResponseOwnerLabel,
} from "../../../shared/standaloneSender";
import { ResponseImageTools } from "./ResponseImageTools";
import {
  Badge,
  EmptyState,
  Field,
  FooterActions,
  PaneHeader,
  StatusDot,
} from "./RulesShared";

type ResponseDraft = NonNullable<PanelController["state"]["responseDraft"]>;
type ResponseRecord = NonNullable<PanelController["selectedResponseRecord"]>;

export function ResponseDetailPane({
  controller,
  compact = false,
}: {
  controller: PanelController;
  compact?: boolean;
}) {
  const record = controller.selectedResponseRecord;
  const draft = controller.state.responseDraft;
  if (!record || !draft) {
    return <EmptyResponseDetail />;
  }

  return (
    <section className="workspace-pane">
      <PaneHeader
        compact={compact}
        title={compact ? draft.name || "安卓发送编辑" : "安卓发送编辑器"}
        subtitle={record.ownerLabel}
        extra={compact ? <BackToListButton onClick={controller.goBack} /> : null}
      />
      <div className="workspace-pane__body">
        <ResponseEditorHeader controller={controller} draft={draft} record={record} />
        <ResponseImageTools controller={controller} />
        <ResponseDetailJson controller={controller} draft={draft} />
      </div>
      <ResponseFooter controller={controller} record={record} />
    </section>
  );
}

function EmptyResponseDetail() {
  return (
    <section className="workspace-pane">
      <PaneHeader title="安卓发送编辑器" subtitle="选择一条安卓发送进行编辑" />
      <div className="workspace-pane__body">
        <EmptyState title="未选择安卓发送" description="从左侧列表选择一条安卓发送。" />
      </div>
    </section>
  );
}

function BackToListButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      className="control-button control-button--ghost control-button--quiet"
      onClick={onClick}
    >
      返回列表
    </button>
  );
}

function ResponseEditorHeader({
  controller,
  draft,
  record,
}: {
  controller: PanelController;
  draft: ResponseDraft;
  record: ResponseRecord;
}) {
  return (
    <div className="response-editor-header workspace-section">
      <section className="response-main-row">
        <InlineField label="消息名称" kind="name">
          <input
            className="control-field"
            value={draft.name}
            onChange={(event) => patchResponseDraft(controller, { name: event.target.value })}
          />
        </InlineField>
        <InlineField label="事件名称" kind="event">
          <input
            className="control-field mono"
            value={draft.eventName}
            onChange={(event) => patchResponseDraft(controller, { eventName: event.target.value })}
          />
        </InlineField>
        <InlineField label="延迟 (ms)" kind="delay">
          <input
            className="control-field mono"
            value={draft.delayMs}
            onChange={(event) => patchResponseDraft(controller, { delayMs: event.target.value })}
          />
        </InlineField>
      </section>
      <section className="response-context-row">
        <InlineField label="归属" kind="sender">
          <ResponseOwnerControl controller={controller} record={record} />
        </InlineField>
        {record.isStandalone ? null : (
          <InlineField label="自动配对" kind="status">
            <ResponseActiveControl controller={controller} record={record} />
          </InlineField>
        )}
      </section>
    </div>
  );
}

function InlineField({
  label,
  children,
  kind,
}: {
  label: string;
  children: React.ReactNode;
  kind: "name" | "delay" | "sender" | "status" | "event";
}) {
  return (
    <div className={`response-meta__field response-meta__field--${kind}`}>
      <span className="response-meta__label">{label}</span>
      <div className="response-meta__control">{children}</div>
    </div>
  );
}

function ResponseActiveControl({
  controller,
  record,
}: {
  controller: PanelController;
  record: ResponseRecord;
}) {
  return (
    <div className="response-meta__status">
      <span className="response-meta__status-text">
        <StatusDot active={record.isActive} />
        {record.isActive ? "当前自动回传" : "当前未自动回传"}
      </span>
      {record.isActive ? (
        <Badge tone="green">自动回传</Badge>
      ) : (
        <button
          type="button"
          className="control-button control-button--quiet"
          onClick={() => controller.setActiveResponse(record.sender.id, record.response.id)}
        >
          设为自动回传
        </button>
      )}
    </div>
  );
}

function ResponseOwnerControl({
  controller,
  record,
}: {
  controller: PanelController;
  record: ResponseRecord;
}) {
  if (record.isStandalone) {
    return <span className="row-card__subtitle">{STANDALONE_RESPONSE_TARGET_LABEL}</span>;
  }

  return (
    <button
      type="button"
      className="link-button response-meta__link"
      onClick={() => controller.openSenderTab(record.sender.id)}
    >
      {getResponseOwnerLabel(record.sender)}
    </button>
  );
}

function ResponseDetailJson({
  controller,
  draft,
}: {
  controller: PanelController;
  draft: ResponseDraft;
}) {
  return (
    <div className="workspace-section">
      <div className="form-grid">
        <Field label="Detail JSON" span2>
          <textarea
            spellCheck={false}
            className="control-textarea mono"
            value={draft.detailText}
            onChange={(event) =>
              patchResponseDraft(controller, { detailText: event.target.value })
            }
          />
        </Field>
      </div>
    </div>
  );
}

function ResponseFooter({
  controller,
  record,
}: {
  controller: PanelController;
  record: ResponseRecord;
}) {
  return (
    <FooterActions
      primary={
        <>
          <button
            type="button"
            className="control-button control-button--primary"
            onClick={controller.saveResponse}
          >
            保存发送
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
            onClick={() => confirmDelete(record.response.name, controller)}
          >
            删除发送
          </button>
      }
    />
  );
}

function patchResponseDraft(controller: PanelController, patch: Partial<ResponseDraft>) {
  controller.setState((current) => ({
    ...current,
    responseDraft: current.responseDraft ? { ...current.responseDraft, ...patch } : null,
  }));
}

function confirmDelete(name: string, controller: PanelController) {
  if (window.confirm(`确认删除安卓发送“${name}”？`)) {
    controller.deleteResponse();
  }
}
