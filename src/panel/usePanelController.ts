import { useEffect, useMemo, useRef, useState } from "react";
import type { BridgeLogItem } from "../shared/bridgeTypes";
import { createId } from "../shared/id";
import { safeParseJson } from "../shared/json";
import type { BackgroundToPanelMessage, PanelCommand } from "../shared/messageTypes";
import { createBlankRule, getPresetRules } from "../shared/presets";
import { createRuleFromLog, validateRule } from "../shared/rules";
import type { BridgeMockRule } from "../shared/ruleTypes";
import { exportRulesFile, parseImportedRules } from "./fileActions";
import type { AppViewState } from "./types";
import { requestSnapshot, syncSnapshotState } from "./helpers";
import {
  createManualEmitDraft,
  createRuleDraft,
  createRuleFromDraft,
  formatDraftJson,
  formatManualEmit,
} from "./utils";

const initialState: AppViewState = {
  snapshot: null,
  selectedRuleId: null,
  ruleDraft: null,
  manualEmit: createManualEmitDraft(),
  filterText: "",
  activeLogEvent: null,
  toast: null,
  importStrategy: "merge",
  activeTab: "rules",
  narrowRuleEditorOpen: false,
};

export function usePanelController(tabId: number) {
  const portRef = useRef<chrome.runtime.Port | null>(null);
  const presetRules = useMemo(() => getPresetRules(), []);
  const [state, setState] = useState<AppViewState>(initialState);

  useEffect(() => {
    const port = chrome.runtime.connect({ name: "h5-bridge-panel" });
    portRef.current = port;
    port.postMessage({ type: "PANEL_INIT", tabId });

    const handleMessage = (message: BackgroundToPanelMessage) => {
      if (message.type !== "BACKGROUND_EVENT") {
        return;
      }

      const event = message.event;
      if (event.type === "SNAPSHOT") {
        setState((current) => syncSnapshotState(current, event.snapshot));
        return;
      }

      setState((current) => ({
        ...current,
        toast: {
          level: event.level,
          message: event.message,
        },
      }));
    };

    port.onMessage.addListener(handleMessage);
    requestSnapshot(port, tabId);

    return () => {
      port.onMessage.removeListener(handleMessage);
      port.disconnect();
      portRef.current = null;
    };
  }, [tabId]);

  useEffect(() => {
    if (!state.toast) {
      return;
    }

    const timer = window.setTimeout(() => {
      setState((current) => ({ ...current, toast: null }));
    }, 2200);

    return () => window.clearTimeout(timer);
  }, [state.toast]);

  const filteredRules = useMemo(() => {
    const rules = state.snapshot?.rules ?? [];
    const filter = state.filterText.trim().toLowerCase();
    if (!filter) {
      return rules;
    }

    return rules.filter((rule) => {
      const name = rule.name.toLowerCase();
      const eventName = rule.match.event.toLowerCase();
      return name.includes(filter) || eventName.includes(filter);
    });
  }, [state.filterText, state.snapshot?.rules]);

  const filteredLogs = useMemo(() => {
    const logs = state.snapshot?.logs ?? [];
    if (!state.activeLogEvent) {
      return logs;
    }
    return logs.filter((log) => log.event === state.activeLogEvent);
  }, [state.activeLogEvent, state.snapshot?.logs]);

  function postCommand(command: PanelCommand) {
    portRef.current?.postMessage({
      type: "PANEL_COMMAND",
      tabId,
      command,
    });
  }

  function setToast(level: "info" | "error", message: string) {
    setState((current) => ({
      ...current,
      toast: { level, message },
    }));
  }

  function selectRuleById(ruleId: string) {
    const rule = state.snapshot?.rules.find((item) => item.id === ruleId);
    if (!rule) {
      return;
    }

    setState((current) => ({
      ...current,
      selectedRuleId: rule.id,
      ruleDraft: createRuleDraft(rule),
      narrowRuleEditorOpen: true,
    }));
  }

  function saveRule() {
    const draft = state.ruleDraft;
    const snapshot = state.snapshot;
    if (!draft || !snapshot) {
      return;
    }

    const sourceRule =
      snapshot.rules.find((rule) => rule.id === draft.id) ?? createBlankRule();
    const nextRule = createRuleFromDraft(draft, sourceRule);
    if (!nextRule.ok) {
      setToast("error", nextRule.error);
      return;
    }

    const errors = validateRule(nextRule.rule);
    if (errors.length > 0) {
      setToast("error", errors[0]);
      return;
    }

    postCommand({ type: "UPSERT_RULE", rule: nextRule.rule });
    setToast("info", "规则已保存");
  }

  function deleteRule() {
    if (!state.selectedRuleId) {
      return;
    }
    postCommand({ type: "DELETE_RULE", ruleId: state.selectedRuleId });
    setState((current) => ({
      ...current,
      selectedRuleId: null,
      ruleDraft: null,
    }));
  }

  function duplicateRule() {
    if (!state.selectedRuleId) {
      return;
    }
    postCommand({ type: "DUPLICATE_RULE", ruleId: state.selectedRuleId });
  }

  function addBlankRule() {
    const rule = { ...createBlankRule(), id: createId("rule") };
    setState((current) => ({
      ...current,
      selectedRuleId: rule.id,
      ruleDraft: createRuleDraft(rule),
      narrowRuleEditorOpen: true,
    }));
  }

  function addPresetRule(presetId: string) {
    const preset = presetRules.find((item) => item.id === presetId);
    if (!preset) {
      return;
    }

    const nextRule = { ...preset, id: createId("rule") };
    setState((current) => ({
      ...current,
      selectedRuleId: nextRule.id,
      ruleDraft: createRuleDraft(nextRule),
      narrowRuleEditorOpen: true,
    }));
  }

  function loadPresetToDraft(rule: BridgeMockRule | null) {
    if (!rule || !state.ruleDraft) {
      return;
    }

    const nextRule = {
      ...rule,
      id: state.ruleDraft.id,
      meta: {
        ...rule.meta,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    };
    setState((current) => ({
      ...current,
      ruleDraft: createRuleDraft(nextRule),
    }));
  }

  function testEmitDraft() {
    const draft = state.ruleDraft;
    if (!draft) {
      return;
    }
    const parsed = safeParseJson(draft.detailText);
    if (!parsed.ok) {
      setToast("error", `Detail JSON 无效: ${parsed.error}`);
      return;
    }
    postCommand({
      type: "MANUAL_EMIT",
      eventName: draft.eventName,
      detail: parsed.value,
    });
  }

  function exportRules() {
    if (!state.snapshot) {
      return;
    }
    exportRulesFile(state.snapshot.origin, state.snapshot.rules);
  }

  function importRules(content: string) {
    const parsed = parseImportedRules(content);
    if (!parsed.ok) {
      setToast("error", parsed.error);
      return;
    }

    postCommand({
      type: "IMPORT_RULES",
      rules: parsed.rules,
      strategy: state.importStrategy,
    });
  }

  function sendManualEmit() {
    const parsed = safeParseJson(state.manualEmit.detailText);
    if (!parsed.ok) {
      setToast("error", `Detail JSON 无效: ${parsed.error}`);
      return;
    }
    if (!state.manualEmit.eventName.trim()) {
      setToast("error", "事件名不能为空");
      return;
    }
    postCommand({
      type: "MANUAL_EMIT",
      eventName: state.manualEmit.eventName.trim(),
      detail: parsed.value,
    });
  }

  function createRuleFromSelectedLog(log: BridgeLogItem) {
    const rule = createRuleFromLog(log);
    setState((current) => ({
      ...current,
      selectedRuleId: rule.id,
      ruleDraft: createRuleDraft(rule),
      activeTab: "rules",
      narrowRuleEditorOpen: true,
    }));
  }

  function copyText(text: string) {
    void navigator.clipboard.writeText(text);
  }

  return {
    state,
    setState,
    filteredRules,
    filteredLogs,
    presetRules,
    postCommand,
    selectRuleById,
    saveRule,
    deleteRule,
    duplicateRule,
    addBlankRule,
    addPresetRule,
    loadPresetToDraft,
    testEmitDraft,
    exportRules,
    importRules,
    sendManualEmit,
    createRuleFromSelectedLog,
    copyText,
    formatCurrentRuleJson() {
      setState((current) => ({
        ...current,
        ruleDraft: current.ruleDraft ? formatDraftJson(current.ruleDraft) : null,
      }));
    },
    resetCurrentRule() {
      const original = state.snapshot?.rules.find(
        (rule) => rule.id === state.selectedRuleId,
      );
      if (!original) {
        return;
      }
      setState((current) => ({
        ...current,
        ruleDraft: createRuleDraft(original),
      }));
    },
    formatManualEmitDraft() {
      setState((current) => ({
        ...current,
        manualEmit: formatManualEmit(current.manualEmit),
      }));
    },
  };
}
