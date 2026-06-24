import type {
  BridgePanelSnapshot,
  BridgeStorageState,
  OriginBridgeState,
} from "./bridgeTypes";
import { cloneJson } from "./json";
import { getPresetRules } from "./presets";
import type {
  BridgeMockRule,
  OriginBridgeSettings,
  RuleExportPayload,
} from "./ruleTypes";
import { STORAGE_KEY } from "./constants";

export const DEFAULT_SETTINGS: OriginBridgeSettings = {
  autoMock: true,
  preserveLogs: false,
  maxLogCount: 200,
  overrideExistingAndroidBridge: true,
};

export function createDefaultOriginState(): OriginBridgeState {
  return {
    rules: getPresetRules(),
    logs: [],
    settings: { ...DEFAULT_SETTINGS },
  };
}

export async function readStorageState(): Promise<BridgeStorageState> {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  const snapshot = stored[STORAGE_KEY] as BridgeStorageState | undefined;
  return normalizeStorageState(snapshot);
}

export async function writeStorageState(
  state: BridgeStorageState,
): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: state });
}

export async function ensureOriginState(origin: string): Promise<BridgeStorageState> {
  const state = await readStorageState();
  if (state.origins[origin]) {
    return state;
  }

  const nextState = {
    ...state,
    origins: {
      ...state.origins,
      [origin]: createDefaultOriginState(),
    },
  };
  await writeStorageState(nextState);
  return nextState;
}

export async function buildSnapshot(
  origin: string,
  href: string,
): Promise<BridgePanelSnapshot> {
  const state = await ensureOriginState(origin);
  const originState = state.origins[origin] ?? createDefaultOriginState();
  return {
    origin,
    href,
    globalEnabled: state.globalEnabled,
    rules: cloneJson(originState.rules),
    logs: cloneJson(originState.logs),
    settings: { ...originState.settings },
  };
}

export async function updateStorageState(
  updater: (state: BridgeStorageState) => BridgeStorageState,
): Promise<BridgeStorageState> {
  const currentState = await readStorageState();
  const nextState = updater(currentState);
  await writeStorageState(nextState);
  return nextState;
}

export function createRulesExport(
  origin: string,
  rules: BridgeMockRule[],
): RuleExportPayload {
  return {
    version: 1,
    name: "H5 桥接调试工具规则",
    origin,
    exportedAt: Date.now(),
    rules: cloneJson(rules),
  };
}

function normalizeStorageState(
  input: BridgeStorageState | undefined,
): BridgeStorageState {
  if (!input) {
    return {
      globalEnabled: true,
      origins: {},
    };
  }

  return {
    globalEnabled: input.globalEnabled ?? true,
    origins: normalizeOrigins(input.origins ?? {}),
  };
}

function normalizeOrigins(
  origins: Record<string, OriginBridgeState>,
): Record<string, OriginBridgeState> {
  return Object.fromEntries(
    Object.entries(origins).map(([origin, state]) => [
      origin,
      {
        rules: cloneJson(state.rules ?? []),
        logs: cloneJson(state.logs ?? []),
        settings: {
          ...DEFAULT_SETTINGS,
          ...(state.settings ?? {}),
        },
      },
    ]),
  );
}
