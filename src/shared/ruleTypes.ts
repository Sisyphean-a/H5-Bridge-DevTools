export type BridgeResponseMode = "dispatchEvent";
export type ImportStrategy = "merge" | "replace" | "appendUnpaired";

export interface BridgeMockRule {
  id: string;
  name: string;
  enabled: boolean;
  match: {
    event: string;
  };
  response: {
    delayMs: number;
    mode: BridgeResponseMode;
    eventName: string;
    detail: unknown;
  };
  meta?: {
    createdAt?: number;
    updatedAt?: number;
    hitCount?: number;
  };
}

export interface OriginBridgeSettings {
  autoMock: boolean;
  preserveLogs: boolean;
  maxLogCount: number;
  overrideExistingBridge: boolean;
}

export interface RuleExportPayload {
  version: 1;
  name: string;
  origin: string;
  exportedAt: number;
  rules: BridgeMockRule[];
}
