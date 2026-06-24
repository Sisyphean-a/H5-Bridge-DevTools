import { useEffect, useState, type CSSProperties } from "react";
import { formatJson } from "../shared/json";
import { panelTheme } from "./designSystem";
import { LogsPanel } from "./components/LogsPanel";
import { ManualEmit } from "./components/ManualEmit";
import { RuleEditor } from "./components/RuleEditor";
import { RulesList } from "./components/RulesList";
import { SettingsPanel } from "./components/SettingsPanel";
import { Toolbar } from "./components/Toolbar";
import { usePanelController } from "./usePanelController";

interface AppProps {
  tabId: number;
}

export function App({ tabId }: AppProps) {
  const controller = usePanelController(tabId);
  const {
    state,
    setState,
    filteredRules,
    filteredLogs,
    presetRules,
    postCommand,
    selectRuleById,
  } = controller;
  const [isWide, setIsWide] = useState(() => window.innerWidth >= 1080);

  useEffect(() => {
    function handleResize() {
      setIsWide(window.innerWidth >= 1080);
    }

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const enabledCount =
    state.snapshot?.rules.filter((rule) => rule.enabled).length ?? 0;

  const rulesContent = (
    <>
      <div style={rulesPaneStyle}>
        <RulesList
          rules={filteredRules}
          selectedRuleId={state.selectedRuleId}
          filterText={state.filterText}
          presetRules={presetRules}
          enabledCount={enabledCount}
          onFilterChange={(value) =>
            setState((current) => ({ ...current, filterText: value }))
          }
          onSelect={selectRuleById}
          onAddBlank={controller.addBlankRule}
          onAddFromPreset={controller.addPresetRule}
          onToggle={(ruleId, enabled) =>
            postCommand({ type: "TOGGLE_RULE", ruleId, enabled })
          }
        />
      </div>
      <div style={editorPaneStyle}>
        <RuleEditor
          draft={state.ruleDraft}
          isNarrow={!isWide}
          onChange={(draft) =>
            setState((current) => ({ ...current, ruleDraft: draft }))
          }
          onSave={controller.saveRule}
          onDelete={controller.deleteRule}
          onDuplicate={controller.duplicateRule}
          onReset={controller.resetCurrentRule}
          onFormatJson={controller.formatCurrentRuleJson}
          onTestEmit={controller.testEmitDraft}
          presets={presetRules}
          onLoadPreset={controller.loadPresetToDraft}
          onBack={
            !isWide
              ? () =>
                  setState((current) => ({
                    ...current,
                    narrowRuleEditorOpen: false,
                  }))
              : undefined
          }
        />
      </div>
    </>
  );

  const logsContent = (
    <LogsPanel
      logs={filteredLogs}
      activeEvent={state.activeLogEvent}
      compact={isWide}
      onCopyPayload={controller.copyText}
      onCreateRule={controller.createRuleFromSelectedLog}
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
    <div style={appShellStyle}>
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

      <div style={contentStyle}>
        {isWide && state.activeTab === "rules" ? (
          <>
            {rulesContent}
            <div style={logsPaneStyle}>{logsContent}</div>
          </>
        ) : null}

        {isWide && state.activeTab === "logs" ? (
          <div style={singlePaneStyle}>{logsContent}</div>
        ) : null}

        {isWide && state.activeTab === "manual" ? (
          <div style={singlePaneStyle}>
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

        {isWide && state.activeTab === "settings" ? (
          <div style={singlePaneStyle}>
            <SettingsPanel
              settings={state.snapshot?.settings ?? null}
              onChange={(patch) =>
                postCommand({ type: "UPDATE_SETTINGS", settings: patch })
              }
            />
          </div>
        ) : null}

        {!isWide && state.activeTab === "rules" ? (
          <div style={singlePaneStyle}>
            {state.narrowRuleEditorOpen && state.ruleDraft ? (
              <RuleEditor
                draft={state.ruleDraft}
                isNarrow
                onChange={(draft) =>
                  setState((current) => ({ ...current, ruleDraft: draft }))
                }
                onSave={controller.saveRule}
                onDelete={controller.deleteRule}
                onDuplicate={controller.duplicateRule}
                onReset={controller.resetCurrentRule}
                onFormatJson={controller.formatCurrentRuleJson}
                onTestEmit={controller.testEmitDraft}
                presets={presetRules}
                onLoadPreset={controller.loadPresetToDraft}
                onBack={() =>
                  setState((current) => ({
                    ...current,
                    narrowRuleEditorOpen: false,
                  }))
                }
              />
            ) : (
              <RulesList
                rules={filteredRules}
                selectedRuleId={state.selectedRuleId}
                filterText={state.filterText}
                presetRules={presetRules}
                enabledCount={enabledCount}
                onFilterChange={(value) =>
                  setState((current) => ({ ...current, filterText: value }))
                }
                onSelect={selectRuleById}
                onAddBlank={controller.addBlankRule}
                onAddFromPreset={controller.addPresetRule}
                onToggle={(ruleId, enabled) =>
                  postCommand({ type: "TOGGLE_RULE", ruleId, enabled })
                }
              />
            )}
          </div>
        ) : null}

        {!isWide && state.activeTab === "logs" ? (
          <div style={singlePaneStyle}>{logsContent}</div>
        ) : null}

        {!isWide && state.activeTab === "manual" ? (
          <div style={singlePaneStyle}>
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

        {!isWide && state.activeTab === "settings" ? (
          <div style={singlePaneStyle}>
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
          className={`toast ${state.toast.level === "error" ? "toast--error" : ""}`}
        >
          {state.toast.message}
        </div>
      ) : null}
    </div>
  );
}

const appShellStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  height: "100%",
  background: panelTheme.bg,
  color: panelTheme.text,
};

const contentStyle: CSSProperties = {
  display: "flex",
  flex: 1,
  minHeight: 0,
  overflow: "hidden",
};

const singlePaneStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
  minHeight: 0,
};

const rulesPaneStyle: CSSProperties = {
  width: 320,
  minWidth: 260,
  maxWidth: 380,
  borderRight: `1px solid ${panelTheme.border}`,
  minHeight: 0,
};

const editorPaneStyle: CSSProperties = {
  flex: 1,
  minWidth: 320,
  borderRight: `1px solid ${panelTheme.border}`,
  minHeight: 0,
};

const logsPaneStyle: CSSProperties = {
  width: 420,
  minWidth: 320,
  maxWidth: 520,
  minHeight: 0,
};
