import type { BridgeLogItem, BridgePanelSnapshot } from "../shared/bridgeTypes";
import type { ImportStrategy } from "../shared/ruleTypes";
import type { BridgeSender } from "../shared/senderTypes";

export type PanelTabId = "rules" | "logs" | "manual" | "settings";

export interface ToastState {
  level: "success" | "info" | "error";
  message: string;
}

export interface RuleDraft {
  id: string;
  name: string;
  enabled: boolean;
  matchEvent: string;
  delayMs: string;
  mode: "dispatchEvent";
  eventName: string;
  detailText: string;
}

export interface SenderDraft {
  id: string;
  name: string;
  enabled: boolean;
  matchEvent: string;
}

export interface ResponseDraft {
  senderId: string;
  id: string;
  name: string;
  delayMs: number;
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
  selectedRuleId: string | null;
  ruleDraft: RuleDraft | null;
  selectedSenderId: string | null;
  senderDraft: SenderDraft | null;
  selectedResponse: { senderId: string; responseId: string } | null;
  responseDraft: ResponseDraft | null;
  manualEmit: ManualEmitDraft;
  filterText: string;
  activeLogEvent: string | null;
  toast: ToastState | null;
  importStrategy: ImportStrategy;
  activeTab: PanelTabId;
  narrowRuleEditorOpen: boolean;
}

export interface RuleEditorProps {
  draft: RuleDraft | null;
  isNarrow: boolean;
  onChange: (draft: RuleDraft) => void;
  onSave: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onReset: () => void;
  onFormatJson: () => void;
  onTestEmit: () => void;
  presets: BridgeSender[];
  onLoadPreset: (sender: BridgeSender | null) => void;
  onBack?: () => void;
}

export interface RulesListProps {
  rules: BridgeSender[];
  selectedRuleId: string | null;
  filterText: string;
  presetRules: BridgeSender[];
  enabledCount: number;
  onFilterChange: (value: string) => void;
  onSelect: (senderId: string) => void;
  onAddBlank: () => void;
  onAddFromPreset: (presetId: string) => void;
  onToggle: (senderId: string, enabled: boolean) => void;
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
