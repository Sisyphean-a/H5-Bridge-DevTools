import type {
  BridgeLogItem,
  BridgeStorageState,
  OriginBridgeProfileState,
  OriginScopedBridgeState,
} from "./bridgeTypes";
import { getPresetSenders } from "./presets";
import { createId } from "./id";
import { cloneJson } from "./json";
import { normalizeSenders } from "./rules";
import type { BridgeMockRule, OriginBridgeSettings } from "./ruleTypes";
import type { BridgeResponseOption, BridgeSender } from "./senderTypes";

type LegacyOriginBridgeSettings = Partial<OriginBridgeSettings> & {
  overrideExistingAndroidBridge?: boolean;
};

interface LegacyOriginBridgeState {
  rules: BridgeMockRule[];
  logs: BridgeLogItem[];
  settings: LegacyOriginBridgeSettings;
}

export interface LegacyStorageState {
  globalEnabled: boolean;
  origins: Record<string, LegacyOriginBridgeState>;
}

export function migrateRuleToSender(rule: BridgeMockRule): BridgeSender {
  const response: BridgeResponseOption = {
    id: createId("resp"),
    name: rule.name || "默认响应",
    delayMs: rule.response.delayMs,
    mode: rule.response.mode,
    eventName: rule.response.eventName,
    detail: cloneJson(rule.response.detail),
    meta: { ...rule.meta },
  };

  return {
    id: rule.id,
    name: rule.name,
    matchEvent: rule.match.event,
    responses: [response],
    activeResponseId: rule.enabled ? response.id : null,
    lastActiveResponseId: response.id,
    meta: { ...rule.meta },
  };
}

function migrateOriginState(state: LegacyOriginBridgeState): OriginScopedBridgeState {
  const pkg01State: OriginBridgeProfileState = {
    senders: normalizeSenders((state.rules ?? []).map(migrateRuleToSender)),
    logs: cloneJson(state.logs ?? []),
    settings: {
      autoMock: state.settings?.autoMock ?? true,
      preserveLogs: state.settings?.preserveLogs ?? false,
      maxLogCount: state.settings?.maxLogCount ?? 200,
      overrideExistingBridge:
        state.settings?.overrideExistingBridge ??
        state.settings?.overrideExistingAndroidBridge ??
        true,
    },
  };

  return {
    activeProfileId: "pkg01",
    profiles: {
      pkg01: pkg01State,
      pkg03: {
        senders: getPresetSenders("pkg03"),
        logs: [],
        settings: {
          autoMock: true,
          preserveLogs: false,
          maxLogCount: 200,
          overrideExistingBridge: true,
        },
      },
    },
  };
}

export function migrateStorageState(legacy: LegacyStorageState): BridgeStorageState {
  return {
    globalEnabled: legacy.globalEnabled ?? true,
    origins: Object.fromEntries(
      Object.entries(legacy.origins ?? {}).map(([origin, state]) => [
        origin,
        migrateOriginState(state),
      ]),
    ),
  };
}

export function isLegacyRuleArray(value: unknown): value is BridgeMockRule[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        item !== null &&
        typeof item === "object" &&
        "match" in item &&
        "response" in item,
    )
  );
}
