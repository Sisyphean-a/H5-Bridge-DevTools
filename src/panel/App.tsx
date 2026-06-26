import { useEffect, useState } from "react";
import { formatJson } from "../shared/json";
import { LogsPanel } from "./components/LogsPanel";
import { ManualEmit } from "./components/ManualEmit";
import { RuleWorkspace } from "./components/RuleWorkspace";
import { SettingsPanel } from "./components/SettingsPanel";
import { Toolbar } from "./components/Toolbar";
import { usePanelController } from "./usePanelController";

interface AppProps {
  tabId: number;
}

export function App({ tabId }: AppProps) {
  const controller = usePanelController(tabId);
  const { state, setState, filteredLogs, postCommand } = controller;
  const [isWide, setIsWide] = useState(() => window.innerWidth >= 1080);

  useEffect(() => {
    function handleResize() {
      setIsWide(window.innerWidth >= 1080);
    }

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const logsContent = (
    <LogsPanel
      logs={filteredLogs}
      activeEvent={state.activeLogEvent}
      compact={isWide}
      onCopyPayload={controller.copyText}
      onCreateRule={controller.createSenderFromLog}
      onReplay={(logId) => postCommand({ type: "REPLAY_LOG_RESPONSE", logId })}
      onFilterEvent={(eventName) =>
        setState((current) => ({ ...current, activeLogEvent: eventName }))
      }
      onClear={() => postCommand({ type: "CLEAR_LOGS" })}
      renderPayload={(log) => formatJson(log.payload ?? {})}
      renderResponse={(log) => formatJson(log.response ?? {})}
    />
  );

  return (
    <div className="app-shell">
      <Toolbar
        snapshot={state.snapshot}
        importStrategy={state.importStrategy}
        isWide={isWide}
        activeTab={state.activeTab}
        onTabChange={(tab) =>
          setState((current) => ({
            ...current,
            activeTab: tab,
          }))
        }
        onToggleGlobal={(enabled) =>
          postCommand({ type: "SET_GLOBAL_ENABLED", enabled })
        }
        onClearLogs={() => postCommand({ type: "CLEAR_LOGS" })}
        onExportRules={controller.exportRules}
        onImportRules={controller.importRules}
        onImportStrategyChange={(value) =>
          setState((current) => ({ ...current, importStrategy: value }))
        }
      />
      <div className="app-content">
        {state.activeTab === "rules" ? <RuleWorkspace controller={controller} isWide={isWide} /> : null}
        {state.activeTab === "logs" ? <div className="rules-frame">{logsContent}</div> : null}
        {state.activeTab === "manual" ? (
          <div className="rules-frame">
            <ManualEmit
              draft={state.manualEmit}
              onChange={(draft) =>
                setState((current) => ({ ...current, manualEmit: draft }))
              }
              onSend={controller.sendManualEmit}
              onFormat={controller.formatManualEmitDraft}
            />
          </div>
        ) : null}
        {state.activeTab === "settings" ? (
          <div className="rules-frame">
            <SettingsPanel
              settings={state.snapshot?.settings ?? null}
              onChange={(patch) =>
                postCommand({ type: "UPDATE_SETTINGS", settings: patch })
              }
            />
          </div>
        ) : null}
      </div>
      {state.toast ? (
        <div
          className={`toast ${
            state.toast.level === "success"
              ? "toast--success"
              : state.toast.level === "error"
                ? "toast--error"
                : ""
          }`}
        >
          {state.toast.message}
        </div>
      ) : null}
    </div>
  );
}
