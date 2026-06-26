import type { BridgeResponseMode } from "./ruleTypes";

export interface BridgeResponseMeta {
  createdAt?: number;
  updatedAt?: number;
  hitCount?: number;
}

export interface BridgeResponseOption {
  id: string;
  name: string;
  delayMs: number;
  mode: BridgeResponseMode;
  eventName: string;
  detail: unknown;
  meta?: BridgeResponseMeta;
}

export interface BridgeSender {
  id: string;
  name: string;
  enabled: boolean;
  matchEvent: string;
  responses: BridgeResponseOption[];
  activeResponseId: string | null;
  meta?: BridgeResponseMeta;
}

export interface SenderExportPayload {
  version: 2;
  name: string;
  origin: string;
  exportedAt: number;
  senders: BridgeSender[];
}
