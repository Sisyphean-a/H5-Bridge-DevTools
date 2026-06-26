import type { BridgeLogItem, BridgePanelSnapshot } from "../shared/bridgeTypes";
import type { ImportStrategy } from "../shared/ruleTypes";

export type PanelTabId = "rules" | "logs" | "manual" | "settings";
export type RulesSubTab = "senders" | "responses" | "matches";

export interface ToastState {
  level: "success" | "info" | "error";
  message: string;
}

export interface SenderDraft {
  id: string;
  name: string;
  matchEvent: string;
}

export interface SelectedResponseRef {
  senderId: string;
  responseId: string;
}

export interface ResponseDraft {
  senderId: string;
  id: string;
  name: string;
  delayMs: string;
  mode: "dispatchEvent";
  eventName: string;
  detailText: string;
}

export interface ManualEmitDraft {
  eventName: string;
  detailText: string;
}

export interface AppViewState {
  snapshot: BridgePanelSnapshot | null;
  selectedSenderId: string | null;
  senderDraft: SenderDraft | null;
  selectedResponse: SelectedResponseRef | null;
  responseDraft: ResponseDraft | null;
  manualEmit: ManualEmitDraft;
  filterText: string;
  activeLogEvent: string | null;
  toast: ToastState | null;
  importStrategy: ImportStrategy;
  activeTab: PanelTabId;
  rulesSubTab: RulesSubTab;
  narrowDetailOpen: boolean;
}

export interface LogsPanelProps {
  logs: BridgeLogItem[];
  activeEvent: string | null;
  compact: boolean;
  onCopyPayload: (text: string) => void;
  onCreateRule: (log: BridgeLogItem) => void;
  onReplay: (logId: string) => void;
  onFilterEvent: (eventName: string | null) => void;
  onClear: () => void;
  renderPayload: (log: BridgeLogItem) => string;
  renderResponse: (log: BridgeLogItem) => string;
}

export interface ToolbarProps {
  snapshot: BridgePanelSnapshot | null;
  importStrategy: ImportStrategy;
  isWide: boolean;
  onToggleGlobal: (enabled: boolean) => void;
  onClearLogs: () => void;
  onExportRules: () => void;
  onImportRules: (content: string) => void;
  onImportStrategyChange: (value: ImportStrategy) => void;
  onTabChange: (tab: PanelTabId) => void;
  activeTab: PanelTabId;
}

export interface ManualEmitProps {
  draft: ManualEmitDraft;
  onChange: (draft: ManualEmitDraft) => void;
  onSend: () => void;
  onFormat: () => void;
}
