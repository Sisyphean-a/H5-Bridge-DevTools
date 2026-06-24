import type { BridgeMockRule, OriginBridgeSettings } from "./ruleTypes";

export type BridgeLogType = "SEND" | "MOCK" | "EMIT" | "WARN" | "ERROR";

export interface BridgeLogItem {
  id: string;
  type: BridgeLogType;
  event?: string;
  timestamp: number;
  payload?: unknown;
  response?: unknown;
  message?: string;
  ruleId?: string;
}

export interface BridgeCallPayload {
  rawMessage: unknown;
  parsedMessage: unknown;
}

export interface OriginBridgeState {
  rules: BridgeMockRule[];
  logs: BridgeLogItem[];
  settings: OriginBridgeSettings;
}

export interface BridgeStorageState {
  globalEnabled: boolean;
  origins: Record<string, OriginBridgeState>;
}

export interface BridgePanelSnapshot {
  origin: string;
  href: string;
  globalEnabled: boolean;
  rules: BridgeMockRule[];
  logs: BridgeLogItem[];
  settings: OriginBridgeSettings;
}
