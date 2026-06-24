import type { BridgeLogItem, BridgePanelSnapshot } from "./bridgeTypes";
import type {
  BridgeMockRule,
  ImportStrategy,
  OriginBridgeSettings,
} from "./ruleTypes";

export type PanelCommand =
  | { type: "REQUEST_SNAPSHOT" }
  | { type: "UPSERT_RULE"; rule: BridgeMockRule }
  | { type: "DELETE_RULE"; ruleId: string }
  | { type: "DUPLICATE_RULE"; ruleId: string }
  | { type: "TOGGLE_RULE"; ruleId: string; enabled: boolean }
  | { type: "IMPORT_RULES"; rules: BridgeMockRule[]; strategy: ImportStrategy }
  | { type: "CLEAR_LOGS" }
  | { type: "SET_GLOBAL_ENABLED"; enabled: boolean }
  | { type: "UPDATE_SETTINGS"; settings: Partial<OriginBridgeSettings> }
  | { type: "MANUAL_EMIT"; eventName: string; detail: unknown }
  | { type: "REPLAY_LOG_RESPONSE"; logId: string };

export type ContentEvent =
  | { type: "SNAPSHOT"; snapshot: BridgePanelSnapshot }
  | { type: "NOTICE"; level: "info" | "error"; message: string };

export type PanelPortMessage =
  | { type: "PANEL_INIT"; tabId: number }
  | { type: "PANEL_COMMAND"; tabId: number; command: PanelCommand };

export type ContentPortMessage =
  | { type: "CONTENT_READY"; snapshot: BridgePanelSnapshot }
  | { type: "CONTENT_EVENT"; event: ContentEvent };

export type BackgroundToPanelMessage = {
  type: "BACKGROUND_EVENT";
  event: ContentEvent;
};

export type BackgroundToContentMessage = {
  type: "BACKGROUND_COMMAND";
  command: PanelCommand;
};

export interface PageDispatchMessage {
  source: string;
  type: "DISPATCH_EVENT";
  payload: {
    eventName: string;
    detail: unknown;
  };
}

export interface PageBridgeCallMessage {
  source: string;
  type: "BRIDGE_CALL";
  payload: {
    rawMessage: unknown;
    parsedMessage: unknown;
  };
}

export interface PageSettingsMessage {
  source: string;
  type: "SYNC_SETTINGS";
  payload: {
    globalEnabled: boolean;
    overrideExistingAndroidBridge: boolean;
  };
}

export type PageRuntimeMessage =
  | PageDispatchMessage
  | PageBridgeCallMessage
  | PageSettingsMessage;

export interface RuleFromLogDraft {
  rule: BridgeMockRule;
  sourceLog: BridgeLogItem;
}
