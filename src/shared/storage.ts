import type {
  BridgePanelSnapshot,
  BridgeStorageState,
  OriginBridgeState,
} from "./bridgeTypes";
import { cloneJson } from "./json";
import { migrateStorageState, type LegacyStorageState } from "./migrate";
import { getPresetSenders } from "./presets";
import { normalizeSenders as normalizeSenderCollection } from "./rules";
import type { OriginBridgeSettings } from "./ruleTypes";
import type { BridgeSender, SenderExportPayload } from "./senderTypes";
import { LEGACY_STORAGE_KEY, STORAGE_KEY } from "./constants";

export const DEFAULT_SETTINGS: OriginBridgeSettings = {
  autoMock: true,
  preserveLogs: false,
  maxLogCount: 200,
  overrideExistingAndroidBridge: true,
};

export function createDefaultOriginState(): OriginBridgeState {
  return {
    senders: getPresetSenders(),
    logs: [],
    settings: { ...DEFAULT_SETTINGS },
  };
}

export async function readStorageState(): Promise<BridgeStorageState> {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  const snapshot = stored[STORAGE_KEY] as BridgeStorageState | undefined;
  if (snapshot) {
    return normalizeStorageState(snapshot);
  }

  const migrated = await migrateLegacyState();
  return normalizeStorageState(migrated);
}

async function migrateLegacyState(): Promise<BridgeStorageState | undefined> {
  const legacyStored = await chrome.storage.local.get(LEGACY_STORAGE_KEY);
  const legacy = legacyStored[LEGACY_STORAGE_KEY] as LegacyStorageState | undefined;
  if (!legacy) {
    return undefined;
  }

  const migrated = migrateStorageState(legacy);
  await writeStorageState(migrated);
  return migrated;
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
    senders: cloneJson(originState.senders),
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

export function createSendersExport(
  origin: string,
  senders: BridgeSender[],
): SenderExportPayload {
  return {
    version: 2,
    name: "H5 桥接调试工具规则",
    origin,
    exportedAt: Date.now(),
    senders: cloneJson(senders),
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
        senders: normalizeSenders(state.senders ?? []),
        logs: cloneJson(state.logs ?? []),
        settings: {
          ...DEFAULT_SETTINGS,
          ...(state.settings ?? {}),
        },
      },
    ]),
  );
}

function normalizeSenders(senders: BridgeSender[]): BridgeSender[] {
  return normalizeSenderCollection(
    senders.map((sender) => {
      const responses = cloneJson(sender.responses ?? []);
      const legacyEnabled = (sender as BridgeSender & { enabled?: boolean }).enabled ?? true;
      const activeResponseId = responses.some(
        (response) => response.id === sender.activeResponseId,
      )
        ? legacyEnabled
          ? sender.activeResponseId
          : null
        : null;
      return {
        id: sender.id,
        name: sender.name,
        matchEvent: sender.matchEvent,
        responses,
        activeResponseId,
        meta: sender.meta,
      };
    }),
  );
}
