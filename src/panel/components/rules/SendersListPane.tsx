import type { ChangeEvent } from "react";
import type { BridgeSender } from "../../../shared/senderTypes";
import type { PanelController } from "../../usePanelController";
import { Badge, EmptyState, PaneHeader, SearchField, ToggleSwitch } from "./RulesShared";

export function SendersListPane({ controller }: { controller: PanelController }) {
  return (
    <section className="workspace-pane">
      <PaneHeader
        title="发送列表"
        subtitle={`已启用 ${controller.enabledSenderCount} / 共 ${controller.filteredSenders.length} 条`}
      />
      <div className="workspace-pane__body is-list">
        <div className="stack workspace-section">
          <div className="search-row">
            <SearchField
              value={controller.state.filterText}
              onChange={(value) =>
                controller.setState((current) => ({ ...current, filterText: value }))
              }
              placeholder="按名称或事件名搜索发送"
            />
            <button
              type="button"
              className="control-button control-button--primary"
              onClick={controller.addBlankSender}
            >
              新建
            </button>
          </div>
          <PresetSelect controller={controller} />
        </div>
        <div className="stack">
          {controller.filteredSenders.length === 0 ? (
            <EmptyState
              title="暂无发送"
              description="添加发送后即可开始匹配桥接事件。"
            />
          ) : (
            controller.filteredSenders.map((sender) => (
              <SenderRow key={sender.id} sender={sender} controller={controller} />
            ))
          )}
        </div>
      </div>
    </section>
  );
}

function PresetSelect({ controller }: { controller: PanelController }) {
  return (
    <select
      className="control-select"
      defaultValue=""
      onChange={(event: ChangeEvent<HTMLSelectElement>) => {
        if (!event.target.value) {
          return;
        }
        controller.addPresetSender(event.target.value);
        event.target.value = "";
      }}
    >
      <option value="">从模板创建发送</option>
      {controller.presetSenders.map((sender) => (
        <option key={sender.id} value={sender.id}>
          {sender.name}
        </option>
      ))}
    </select>
  );
}

function SenderRow({
  sender,
  controller,
}: {
  sender: BridgeSender;
  controller: PanelController;
}) {
  const activeResponse =
    sender.responses.find((item) => item.id === sender.activeResponseId) ?? null;
  const isSelected = controller.state.selectedSenderId === sender.id;
  return (
    <button
      type="button"
      className={`row-card${isSelected ? " is-selected" : ""}`}
      onClick={() => controller.selectSender(sender.id)}
    >
      <div className="row-card__top">
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
        <div className="row-card__aside">
          <Badge tone="blue">{sender.responses.length} 响应</Badge>
          {activeResponse ? <Badge tone="orange">{activeResponse.delayMs}ms</Badge> : null}
        </div>
      </div>
    </button>
  );
}
