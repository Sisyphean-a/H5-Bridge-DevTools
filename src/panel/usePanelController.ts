import { useEffect, useMemo, useRef, useState } from "react";
import type { BackgroundToPanelMessage, PanelCommand } from "../shared/messageTypes";
import { createId } from "../shared/id";
import { safeParseJson } from "../shared/json";
import { createBlankSender, getPresetSenders } from "../shared/presets";
import type { BridgeSender } from "../shared/senderTypes";
import { exportSendersFile, parseImportedSenders } from "./fileActions";
import type { AppViewState } from "./types";
import { requestSnapshot, syncSnapshotState } from "./helpers";
import {
  createManualEmitDraft,
  createRuleDraft,
  formatDraftJson,
  formatManualEmit,
} from "./utils";

const initialState: AppViewState = {
  snapshot: null,
  selectedRuleId: null,
  ruleDraft: null,
  selectedSenderId: null,
  senderDraft: null,
  selectedResponse: null,
  responseDraft: null,
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
  const presetRules = useMemo(() => getPresetSenders(), []);
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
    const senders = state.snapshot?.senders ?? [];
    const filter = state.filterText.trim().toLowerCase();
    if (!filter) {
      return senders;
    }

    return senders.filter((sender) => {
      const name = sender.name.toLowerCase();
      const eventName = sender.matchEvent.toLowerCase();
      return name.includes(filter) || eventName.includes(filter);
    });
  }, [state.filterText, state.snapshot?.senders]);

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

  function setToast(level: "success" | "info" | "error", message: string) {
    setState((current) => ({
      ...current,
      toast: { level, message },
    }));
  }

  function selectRuleById(senderId: string) {
    const sender = state.snapshot?.senders.find((item) => item.id === senderId);
    if (!sender) {
      return;
    }

    const activeResponse = sender.responses.find((r) => r.id === sender.activeResponseId) ?? sender.responses[0];
    if (!activeResponse) {
      return;
    }

    setState((current) => ({
      ...current,
      selectedRuleId: sender.id,
      ruleDraft: createRuleDraft({
        id: sender.id,
        name: sender.name,
        enabled: sender.enabled,
        match: { event: sender.matchEvent },
        response: {
          delayMs: activeResponse.delayMs,
          mode: activeResponse.mode,
          eventName: activeResponse.eventName,
          detail: activeResponse.detail,
        },
        meta: sender.meta,
      }),
      narrowRuleEditorOpen: true,
    }));
  }

  function saveRule() {
    const draft = state.ruleDraft;
    const snapshot = state.snapshot;
    if (!draft || !snapshot) {
      return;
    }

    const parsedDetail = safeParseJson(draft.detailText);
    if (!parsedDetail.ok) {
      setToast("error", `Detail JSON 无效: ${parsedDetail.error}`);
      return;
    }

    const delayMs = Number(draft.delayMs);
    if (!Number.isFinite(delayMs) || delayMs < 0) {
      setToast("error", "Delay 必须是大于等于 0 的数字");
      return;
    }

    const sender = snapshot.senders.find((s) => s.id === draft.id);
    if (!sender) {
      setToast("error", "找不到对应的发送规则");
      return;
    }

    const activeResponse = sender.responses.find((r) => r.id === sender.activeResponseId);
    if (!activeResponse) {
      setToast("error", "找不到活跃响应");
      return;
    }

    postCommand({
      type: "UPSERT_SENDER",
      sender: {
        ...sender,
        name: draft.name.trim(),
        enabled: draft.enabled,
        matchEvent: draft.matchEvent.trim(),
        meta: { ...sender.meta, updatedAt: Date.now() },
      },
    });

    postCommand({
      type: "UPSERT_RESPONSE",
      senderId: sender.id,
      response: {
        ...activeResponse,
        name: draft.name.trim(),
        delayMs,
        mode: draft.mode,
        eventName: draft.eventName.trim(),
        detail: parsedDetail.value,
        meta: { ...activeResponse.meta, updatedAt: Date.now() },
      },
    });

    setToast("success", "规则已保存");
  }

  function deleteRule() {
    if (!state.selectedRuleId) {
      return;
    }
    postCommand({ type: "DELETE_SENDER", senderId: state.selectedRuleId });
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
    postCommand({ type: "DUPLICATE_SENDER", senderId: state.selectedRuleId });
  }

  function addBlankRule() {
    const sender = createBlankSender();
    const activeResponse = sender.responses[0];
    if (!activeResponse) {
      return;
    }

    setState((current) => ({
      ...current,
      selectedRuleId: sender.id,
      ruleDraft: createRuleDraft({
        id: sender.id,
        name: sender.name,
        enabled: sender.enabled,
        match: { event: sender.matchEvent },
        response: {
          delayMs: activeResponse.delayMs,
          mode: activeResponse.mode,
          eventName: activeResponse.eventName,
          detail: activeResponse.detail,
        },
        meta: sender.meta,
      }),
      narrowRuleEditorOpen: true,
    }));
  }

  function addPresetRule(presetId: string) {
    const preset = presetRules.find((item) => item.id === presetId);
    if (!preset) {
      return;
    }

    const activeResponse = preset.responses[0];
    if (!activeResponse) {
      return;
    }

    const nextSender = { ...preset, id: createId("sender") };
    setState((current) => ({
      ...current,
      selectedRuleId: nextSender.id,
      ruleDraft: createRuleDraft({
        id: nextSender.id,
        name: nextSender.name,
        enabled: nextSender.enabled,
        match: { event: nextSender.matchEvent },
        response: {
          delayMs: activeResponse.delayMs,
          mode: activeResponse.mode,
          eventName: activeResponse.eventName,
          detail: activeResponse.detail,
        },
        meta: nextSender.meta,
      }),
      narrowRuleEditorOpen: true,
    }));
  }

  function loadPresetToDraft(sender: BridgeSender | null) {
    if (!sender) {
      return;
    }

    const activeResponse = sender.responses[0];
    if (!activeResponse) {
      return;
    }

    setState((current) => ({
      ...current,
      ruleDraft: createRuleDraft({
        id: current.ruleDraft?.id ?? createId("sender"),
        name: sender.name,
        enabled: sender.enabled,
        match: { event: sender.matchEvent },
        response: {
          delayMs: activeResponse.delayMs,
          mode: activeResponse.mode,
          eventName: activeResponse.eventName,
          detail: activeResponse.detail,
        },
        meta: sender.meta,
      }),
    }));
  }

  function resetCurrentRule() {
    const senderId = state.selectedRuleId;
    const snapshot = state.snapshot;
    if (!senderId || !snapshot) {
      return;
    }

    const sender = snapshot.senders.find((item) => item.id === senderId);
    if (!sender) {
      return;
    }

    const activeResponse = sender.responses.find((r) => r.id === sender.activeResponseId) ?? sender.responses[0];
    if (!activeResponse) {
      return;
    }

    setState((current) => ({
      ...current,
      ruleDraft: createRuleDraft({
        id: sender.id,
        name: sender.name,
        enabled: sender.enabled,
        match: { event: sender.matchEvent },
        response: {
          delayMs: activeResponse.delayMs,
          mode: activeResponse.mode,
          eventName: activeResponse.eventName,
          detail: activeResponse.detail,
        },
        meta: sender.meta,
      }),
    }));
  }

  function formatCurrentRuleJson() {
    const draft = state.ruleDraft;
    if (!draft) {
      return;
    }

    setState((current) => ({
      ...current,
      ruleDraft: formatDraftJson(draft),
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

    const sender = state.snapshot?.senders.find((s) => s.id === draft.id);
    if (!sender) {
      setToast("error", "找不到对应的发送规则");
      return;
    }

    const activeResponse = sender.responses.find((r) => r.id === sender.activeResponseId);
    if (!activeResponse) {
      setToast("error", "找不到活跃响应");
      return;
    }

    postCommand({
      type: "TRIGGER_RESPONSE",
      senderId: sender.id,
      responseId: activeResponse.id,
    });
    setToast("success", "已触发测试");
  }

  function createRuleFromSelectedLog() {
    const logId = state.activeLogEvent;
    const snapshot = state.snapshot;
    if (!logId || !snapshot) {
      return;
    }

    const log = snapshot.logs.find((item) => item.id === logId);
    if (!log) {
      return;
    }

    const sender = createBlankSender();
    sender.name = `从日志创建: ${log.event ?? "未知事件"}`;
    sender.matchEvent = log.event ?? "";

    const response = sender.responses[0];
    if (response) {
      response.eventName = log.event ?? "";
      response.detail = log.payload ?? {};
    }

    setState((current) => ({
      ...current,
      selectedRuleId: sender.id,
      ruleDraft: createRuleDraft({
        id: sender.id,
        name: sender.name,
        enabled: sender.enabled,
        match: { event: sender.matchEvent },
        response: response ? {
          delayMs: response.delayMs,
          mode: response.mode,
          eventName: response.eventName,
          detail: response.detail,
        } : {
          delayMs: 500,
          mode: "dispatchEvent" as const,
          eventName: "",
          detail: {},
        },
        meta: sender.meta,
      }),
      narrowRuleEditorOpen: true,
      activeTab: "rules",
    }));
  }

  function sendManualEmit() {
    const draft = state.manualEmit;
    const parsed = safeParseJson(draft.detailText);
    if (!parsed.ok) {
      setToast("error", `Detail JSON 无效: ${parsed.error}`);
      return;
    }

    postCommand({
      type: "MANUAL_EMIT",
      eventName: draft.eventName.trim(),
      detail: parsed.value,
    });
    setToast("success", "已发送");
  }

  function formatManualEmitDraft() {
    setState((current) => ({
      ...current,
      manualEmit: formatManualEmit(current.manualEmit),
    }));
  }

  function exportRules() {
    const snapshot = state.snapshot;
    if (!snapshot) {
      return;
    }

    const origin = typeof window !== "undefined" ? window.location.origin : "unknown";
    exportSendersFile(origin, snapshot.senders);
    setToast("success", "已导出");
  }

  function importRules(content: string) {
    const result = parseImportedSenders(content);
    if (!result.ok) {
      setToast("error", result.error);
      return;
    }

    postCommand({
      type: "IMPORT_SENDERS",
      senders: result.senders,
      strategy: state.importStrategy,
    });
    setToast("success", "已导入");
  }

  function copyText(text: string) {
    navigator.clipboard.writeText(text).then(
      () => setToast("success", "已复制"),
      () => setToast("error", "复制失败"),
    );
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
    resetCurrentRule,
    formatCurrentRuleJson,
    testEmitDraft,
    createRuleFromSelectedLog,
    sendManualEmit,
    formatManualEmitDraft,
    exportRules,
    importRules,
    copyText,
  };
}
