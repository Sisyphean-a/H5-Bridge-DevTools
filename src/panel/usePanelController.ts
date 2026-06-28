import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import type { BridgeLogItem } from "../shared/bridgeTypes";
import type { BackgroundToPanelMessage } from "../shared/messageTypes";
import { getPresetSenders } from "../shared/presets";
import type { BridgeSender } from "../shared/senderTypes";
import { type PanelActionContext, postCommand, setToast } from "./actionContext";
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
  hasActiveExtensionRuntime,
  isExtensionContextInvalidatedError,
  requestSnapshot,
  syncSnapshotState,
} from "./helpers";
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

const panelContextInvalidatedMessage = "扩展已重载，请关闭并重新打开 DevTools 面板。";

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
  const portRef = useRef<chrome.runtime.Port | null>(null);
  const presetSenders = useMemo(() => getPresetSenders(), []);
  const [state, setState] = useState<AppViewState>(initialState);
  usePanelConnection(tabId, portRef, setState);
  useToastDismiss(state.toast, setState);

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
  const context: PanelActionContext = { portRef, setState, state, tabId };

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
    copyText: (text) => copyText(context, text),
    goBack: () => setState((current) => navigateBackState(current)),
  };
}

function usePanelConnection(
  tabId: number,
  portRef: MutableRefObject<chrome.runtime.Port | null>,
  setState: Dispatch<SetStateAction<AppViewState>>,
): void {
  useEffect(() => {
    let disposed = false;
    let reconnectTimer: number | null = null;

    const connect = () => {
      if (disposed) {
        return;
      }

      const runtime = chrome.runtime;
      if (!hasActiveExtensionRuntime(runtime)) {
        setToast({ setState }, "error", panelContextInvalidatedMessage);
        return;
      }

      let port: chrome.runtime.Port;
      try {
        port = runtime.connect({ name: "h5-bridge-panel" });
      } catch (error) {
        if (isExtensionContextInvalidatedError(error)) {
          setToast({ setState }, "error", panelContextInvalidatedMessage);
          return;
        }
        throw error;
      }
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

      const handleDisconnect = () => {
        port.onMessage.removeListener(handleMessage);
        port.onDisconnect.removeListener(handleDisconnect);
        if (portRef.current === port) {
          portRef.current = null;
        }
        if (disposed) {
          return;
        }
        reconnectTimer = window.setTimeout(connect, 60);
      };

      port.onMessage.addListener(handleMessage);
      port.onDisconnect.addListener(handleDisconnect);
      requestSnapshot(port, tabId);
    };

    connect();

    return () => {
      disposed = true;
      if (reconnectTimer !== null) {
        window.clearTimeout(reconnectTimer);
      }
      const port = portRef.current;
      portRef.current = null;
      port?.disconnect();
    };
  }, [tabId, portRef, setState]);
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
