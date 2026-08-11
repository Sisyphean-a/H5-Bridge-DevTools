import type { BridgeProfile, BridgeProfileId } from "./bridgeProfiles";
import type { OriginBridgeSettings } from "./ruleTypes";
import type { BridgeSender } from "./senderTypes";

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
  senders: BridgeSender[];
  logs: BridgeLogItem[];
  settings: OriginBridgeSettings;
}

export interface OriginBridgeProfileState extends OriginBridgeState {}

export interface BridgeStorageState {
  globalEnabled: boolean;
  origins: Record<string, OriginScopedBridgeState>;
}

export interface OriginScopedBridgeState {
  activeProfileId: BridgeProfileId;
  profiles: Record<BridgeProfileId, OriginBridgeProfileState>;
  profileDefinitions: Record<BridgeProfileId, BridgeProfile>;
  knownHostObjects: string[];
}

export interface BridgePanelSnapshot {
  origin: string;
  href: string;
  globalEnabled: boolean;
  activeProfileId: BridgeProfileId;
  activeProfile: BridgeProfile;
  profiles: BridgeProfile[];
  senders: BridgeSender[];
  logs: BridgeLogItem[];
  settings: OriginBridgeSettings;
}
