import type { BridgePanelSnapshot } from "../shared/bridgeTypes";
import type { OriginBridgeSettings } from "../shared/ruleTypes";
import type { BridgeResponseOption, BridgeSender } from "../shared/senderTypes";

const defaultSettings: OriginBridgeSettings = {
  autoMock: true,
  preserveLogs: false,
  maxLogCount: 200,
  overrideExistingAndroidBridge: true,
};

export function createResponse(
  id: string,
  overrides: Partial<BridgeResponseOption> = {},
): BridgeResponseOption {
  return {
    id,
    name: `response-${id}`,
    delayMs: 0,
    mode: "dispatchEvent",
    eventName: `event-${id}`,
    detail: { id },
    meta: { createdAt: 1, updatedAt: 1, hitCount: 0 },
    ...overrides,
  };
}

export function createSender(
  id: string,
  overrides: Partial<BridgeSender> = {},
): BridgeSender {
  const responses = overrides.responses ?? [createResponse(`${id}-resp-1`)];
  const activeResponseId =
    overrides.activeResponseId === undefined
      ? (responses[0]?.id ?? null)
      : overrides.activeResponseId;

  const base: BridgeSender = {
    id,
    name: `sender-${id}`,
    enabled: true,
    matchEvent: `event-${id}`,
    responses,
    activeResponseId,
    meta: { createdAt: 1, updatedAt: 1, hitCount: 0 },
  };

  return {
    ...base,
    ...overrides,
    responses,
    activeResponseId,
  };
}

export function createSnapshot(
  overrides: Partial<BridgePanelSnapshot> = {},
): BridgePanelSnapshot {
  return {
    origin: "https://example.com",
    href: "https://example.com/page",
    globalEnabled: true,
    senders: [],
    logs: [],
    settings: { ...defaultSettings },
    ...overrides,
  };
}
