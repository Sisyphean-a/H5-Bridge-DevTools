import type { ImportStrategy, OriginBridgeSettings } from "./ruleTypes";
import type { BridgeProfileId } from "./bridgeProfiles";
import type { BridgeResponseOption, BridgeSender } from "./senderTypes";

export type PanelCommand =
  | { type: "REQUEST_SNAPSHOT" }
  | { type: "SET_ACTIVE_PROFILE"; profileId: BridgeProfileId }
  | { type: "UPSERT_SENDER"; sender: BridgeSender }
  | { type: "DELETE_SENDER"; senderId: string }
  | { type: "DUPLICATE_SENDER"; senderId: string }
  | { type: "SET_ACTIVE_RESPONSE"; senderId: string; responseId: string | null }
  | { type: "UPSERT_RESPONSE"; senderId: string; response: BridgeResponseOption }
  | { type: "DELETE_RESPONSE"; senderId: string; responseId: string }
  | { type: "TRIGGER_RESPONSE"; senderId: string; responseId: string }
  | { type: "IMPORT_SENDERS"; senders: BridgeSender[]; strategy: ImportStrategy }
  | { type: "CLEAR_LOGS" }
  | { type: "SET_GLOBAL_ENABLED"; enabled: boolean }
  | { type: "UPDATE_SETTINGS"; settings: Partial<OriginBridgeSettings> }
  | { type: "MANUAL_EMIT"; eventName: string; detail: unknown }
  | { type: "REPLAY_LOG_RESPONSE"; logId: string };

export interface PanelCommandRequest {
  type: "PANEL_COMMAND";
  tabId: number;
  command: PanelCommand;
}

export type PanelCommandResponse =
  | { ok: true }
  | { ok: false; message: string };

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
    profileId: BridgeProfileId;
    overrideExistingBridge: boolean;
  };
}

export type PageRuntimeMessage =
  | PageDispatchMessage
  | PageBridgeCallMessage
  | PageSettingsMessage;
