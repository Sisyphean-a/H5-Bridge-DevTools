import type { PanelController } from "../usePanelController";
import type { RulesSubTab } from "../types";
import { MatchesView } from "./rules/MatchesView";
import { ResponsesView } from "./rules/ResponsesView";
import { SendersView } from "./rules/SendersView";

const subTabs: Array<{ id: RulesSubTab; label: string }> = [
  { id: "senders", label: "发送" },
  { id: "responses", label: "响应" },
  { id: "matches", label: "匹配" },
];

export function RuleWorkspace({
  controller,
  isWide,
}: {
  controller: PanelController;
  isWide: boolean;
}) {
  return (
    <section className="rules-workspace">
      <div className="rules-frame">
        <div className="subtab-bar">
          {subTabs.map((tab) => {
            const active = controller.state.rulesSubTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                className={`subtab-button${active ? " is-active" : ""}`}
                onClick={() =>
                  controller.setState((current) => ({
                    ...current,
                    rulesSubTab: tab.id,
                    narrowDetailOpen: false,
                  }))
                }
              >
                <span>{tab.label}</span>
                <span className="subtab-button__count">{getTabCount(controller, tab.id)}</span>
              </button>
            );
          })}
          <div className="spacer" />
          <span className="workspace-pane__subtitle">
            {controller.state.snapshot?.origin ?? "等待页面连接"}
          </span>
        </div>
        {renderActiveView(controller, isWide)}
      </div>
    </section>
  );
}

function renderActiveView(controller: PanelController, isWide: boolean) {
  switch (controller.state.rulesSubTab) {
    case "senders":
      return <SendersView controller={controller} isWide={isWide} />;
    case "responses":
      return <ResponsesView controller={controller} isWide={isWide} />;
    case "matches":
      return <MatchesView controller={controller} />;
  }
}

function getTabCount(controller: PanelController, tab: RulesSubTab): number {
  switch (tab) {
    case "senders":
      return controller.filteredSenders.length;
    case "responses":
      return controller.responseCount;
    case "matches":
      return controller.pairedSenderCount;
  }
}
