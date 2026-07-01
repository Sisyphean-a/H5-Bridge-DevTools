import {
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import type { BridgeLogItem } from "../shared/bridgeTypes";
import { DEFAULT_BRIDGE_PROFILE_ID } from "../shared/bridgeProfiles";
import { getPresetSenders } from "../shared/presets";
import type { BridgeSender } from "../shared/senderTypes";
import { type PanelActionContext, postCommand } from "./actionContext";
import {
  countPairedSenders,
  countResponses,
  filterLogs,
  filterMatchSenders,
  filterResponseRecords,
  filterSenders,
  findResponseRecord,
  findSender,
  type ResponseRecord,
} from "./controllerFilters";
import {
  buildRulesSubTabRoute,
  buildTabRoute,
  createInitialNavigationState,
  navigateBackState,
  pushRouteState,
} from "./navigationState";
import {
  copyText,
  createInitialManualEmitDraft,
  exportRules,
  formatManualEmitDraft,
  importRules,
  sendManualEmit,
} from "./panelActions";
import {
  createResponseForSender,
  deleteResponse,
  formatCurrentResponseJson,
  resetResponse,
  saveResponse,
  selectResponse,
  setActiveResponse,
  triggerSelectedResponse,
} from "./responseActions";
import { usePanelRuntime } from "./runtimeBridge";
import {
  addBlankSender,
  addPresetSender,
  createSenderFromLogEntry,
  deleteSender,
  duplicateSender,
  openSenderTab,
  resetSender,
  saveSender,
  selectSender,
} from "./senderActions";
import type { AppViewState } from "./types";

const initialState: AppViewState = {
  navigation: createInitialNavigationState(),
  snapshot: null,
  selectedSenderId: null,
  senderDraft: null,
  selectedResponse: null,
  responseDraft: null,
  manualEmit: createInitialManualEmitDraft(),
  filterText: "",
  activeLogEvent: null,
  toast: null,
  importStrategy: "merge",
  activeTab: "rules",
  rulesSubTab: "matches",
  narrowDetailOpen: false,
};

export interface PanelController {
  state: AppViewState;
  setState: Dispatch<SetStateAction<AppViewState>>;
  presetSenders: BridgeSender[];
  filteredSenders: BridgeSender[];
  filteredMatchSenders: BridgeSender[];
  filteredResponses: ResponseRecord[];
  filteredLogs: BridgeLogItem[];
  selectedSender: BridgeSender | null;
  selectedResponseRecord: ResponseRecord | null;
  responseCount: number;
  pairedSenderCount: number;
  postCommand: (command: Parameters<typeof postCommand>[1]) => void;
  selectPanelTab: (tab: AppViewState["activeTab"]) => void;
  selectRulesSubTab: (tab: AppViewState["rulesSubTab"]) => void;
  selectSender: (senderId: string) => void;
  openSenderTab: (senderId: string) => void;
  selectResponse: (senderId: string, responseId: string) => void;
  saveSender: () => void;
  deleteSender: () => void;
  duplicateSender: () => void;
  resetSender: () => void;
  addBlankSender: () => void;
  addPresetSender: (presetId: string) => void;
  createResponseForSender: (senderId: string) => void;
  saveResponse: () => void;
  deleteResponse: () => void;
  resetResponse: () => void;
  formatCurrentResponseJson: () => void;
  triggerSelectedResponse: () => void;
  setActiveResponse: (senderId: string, responseId: string | null) => void;
  createSenderFromLog: (log: BridgeLogItem) => void;
  sendManualEmit: () => void;
  formatManualEmitDraft: () => void;
  exportRules: () => void;
  importRules: (content: string) => void;
  copyText: (text: string) => void;
  goBack: () => void;
}

export function usePanelController(tabId: number): PanelController {
  const [state, setState] = useState<AppViewState>(initialState);
  const dispatchRuntimeMessage = usePanelRuntime(tabId, setState);
  useToastDismiss(state.toast, setState);
  const activeProfileId = state.snapshot?.activeProfileId ?? DEFAULT_BRIDGE_PROFILE_ID;
  const presetSenders = useMemo(() => getPresetSenders(activeProfileId), [activeProfileId]);

  const senders = state.snapshot?.senders ?? [];
  const filteredSenders = useMemo(
    () => filterSenders(senders, state.filterText),
    [senders, state.filterText],
  );
  const filteredMatchSenders = useMemo(
    () => filterMatchSenders(senders, state.filterText),
    [senders, state.filterText],
  );
  const filteredResponses = useMemo(
    () => filterResponseRecords(senders, state.filterText),
    [senders, state.filterText],
  );
  const filteredLogs = useMemo(
    () => filterLogs(state.snapshot?.logs ?? [], state.activeLogEvent),
    [state.snapshot?.logs, state.activeLogEvent],
  );
  const selectedSender = useMemo(
    () => findSender(senders, state.selectedSenderId),
    [senders, state.selectedSenderId],
  );
  const selectedResponseRecord = useMemo(
    () => findResponseRecord(senders, state.selectedResponse),
    [senders, state.selectedResponse],
  );
  const responseCount = useMemo(() => countResponses(senders), [senders]);
  const pairedSenderCount = useMemo(() => countPairedSenders(senders), [senders]);
  const context: PanelActionContext = { dispatchRuntimeMessage, setState, state, tabId };

  return {
    state,
    setState,
    presetSenders,
    filteredSenders,
    filteredMatchSenders,
    filteredResponses,
    filteredLogs,
    selectedSender,
    selectedResponseRecord,
    responseCount,
    pairedSenderCount,
    postCommand: (command) => postCommand(context, command),
    selectPanelTab: (tab) =>
      setState((current) => pushRouteState(current, buildTabRoute(current, tab))),
    selectRulesSubTab: (tab) =>
      setState((current) => pushRouteState(current, buildRulesSubTabRoute(tab))),
    selectSender: (senderId) => selectSender(context, senderId),
    openSenderTab: (senderId) => openSenderTab(context, senderId),
    selectResponse: (senderId, responseId) =>
      selectResponse(context, senderId, responseId),
    saveSender: () => saveSender(context),
    deleteSender: () => deleteSender(context),
    duplicateSender: () => duplicateSender(context),
    resetSender: () => resetSender(context),
    addBlankSender: () => addBlankSender(context),
    addPresetSender: (presetId) => addPresetSender(context, presetId),
    createResponseForSender: (senderId) => createResponseForSender(context, senderId),
    saveResponse: () => saveResponse(context),
    deleteResponse: () => deleteResponse(context),
    resetResponse: () => resetResponse(context),
    formatCurrentResponseJson: () => formatCurrentResponseJson(context),
    triggerSelectedResponse: () => triggerSelectedResponse(context),
    setActiveResponse: (senderId, responseId) =>
      setActiveResponse(context, senderId, responseId),
    createSenderFromLog: (log) => createSenderFromLogEntry(context, log),
    sendManualEmit: () => sendManualEmit(context),
    formatManualEmitDraft: () => formatManualEmitDraft(context),
    exportRules: () => exportRules(context),
    importRules: (content) => importRules(context, content),
    copyText: (text: string) => copyText(context, text),
    goBack: () => setState((current) => navigateBackState(current)),
  };
}

function useToastDismiss(
  toast: AppViewState["toast"],
  setState: Dispatch<SetStateAction<AppViewState>>,
): void {
  useEffect(() => {
    if (!toast) {
      return;
    }

    const timer = window.setTimeout(() => {
      setState((current) => ({ ...current, toast: null }));
    }, 2200);

    return () => window.clearTimeout(timer);
  }, [toast, setState]);
}
