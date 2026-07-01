import type {
  BridgePanelSnapshot,
  BridgeStorageState,
  OriginBridgeProfileState,
  OriginScopedBridgeState,
} from "./bridgeTypes";
import {
  BRIDGE_PROFILES,
  DEFAULT_BRIDGE_PROFILE_ID,
  getBridgeProfile,
  isBridgeProfileId,
  type BridgeProfileId,
} from "./bridgeProfiles";
import { cloneJson } from "./json";
import { migrateStorageState, type LegacyStorageState } from "./migrate";
import { getPresetSenders } from "./presets";
import {
  normalizeResponseSelection,
  normalizeSenders as normalizeSenderCollection,
} from "./rules";
import type { OriginBridgeSettings } from "./ruleTypes";
import type { BridgeSender, SenderExportPayload } from "./senderTypes";
import { LEGACY_STORAGE_KEY, STORAGE_KEY } from "./constants";

export const DEFAULT_SETTINGS: OriginBridgeSettings = {
  autoMock: true,
  preserveLogs: false,
  maxLogCount: 200,
  overrideExistingBridge: true,
};

export function createDefaultProfileState(
  profileId: BridgeProfileId,
): OriginBridgeProfileState {
  return {
    senders: getPresetSenders(profileId),
    logs: [],
    settings: { ...DEFAULT_SETTINGS },
  };
}

export function createDefaultOriginState(): OriginScopedBridgeState {
  return {
    activeProfileId: DEFAULT_BRIDGE_PROFILE_ID,
    profiles: Object.fromEntries(
      BRIDGE_PROFILES.map((profile) => [
        profile.id,
        createDefaultProfileState(profile.id),
      ]),
    ) as Record<BridgeProfileId, OriginBridgeProfileState>,
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
  const { globalEnabled, originState } = await readOriginScopedState(origin);
  const profileState = getActiveProfileState(originState);
  return {
    origin,
    href,
    globalEnabled,
    activeProfileId: originState.activeProfileId,
    senders: cloneJson(profileState.senders),
    logs: cloneJson(profileState.logs),
    settings: { ...profileState.settings },
  };
}

export async function readOriginScopedState(
  origin: string,
): Promise<{ globalEnabled: boolean; originState: OriginScopedBridgeState }> {
  const state = await ensureOriginState(origin);
  return {
    globalEnabled: state.globalEnabled,
    originState: cloneJson(state.origins[origin] ?? createDefaultOriginState()),
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
  origins: Record<string, OriginScopedBridgeState | OriginBridgeProfileState>,
): Record<string, OriginScopedBridgeState> {
  return Object.fromEntries(
    Object.entries(origins).map(([origin, state]) => [
      origin,
      normalizeOriginState(state),
    ]),
  );
}

function normalizeOriginState(
  state: OriginScopedBridgeState | OriginBridgeProfileState | undefined,
): OriginScopedBridgeState {
  if (!state) {
    return createDefaultOriginState();
  }

  if (isScopedOriginState(state)) {
    const activeProfileId = isBridgeProfileId(state.activeProfileId)
      ? state.activeProfileId
      : DEFAULT_BRIDGE_PROFILE_ID;
    return {
      activeProfileId,
      profiles: {
        pkg01: normalizeProfileState(state.profiles?.pkg01, "pkg01"),
        pkg03: normalizeProfileState(state.profiles?.pkg03, "pkg03"),
      },
    };
  }

  return {
    activeProfileId: DEFAULT_BRIDGE_PROFILE_ID,
    profiles: {
      pkg01: normalizeProfileState(state, "pkg01"),
      pkg03: createDefaultProfileState("pkg03"),
    },
  };
}

function normalizeProfileState(
  state: Partial<OriginBridgeProfileState> | undefined,
  profileId: BridgeProfileId,
): OriginBridgeProfileState {
  return {
    senders: normalizeSenders(state?.senders ?? getPresetSenders(profileId)),
    logs: cloneJson(state?.logs ?? []),
    settings: normalizeSettings(state?.settings),
  };
}

function normalizeSettings(
  settings: Partial<OriginBridgeSettings & { overrideExistingAndroidBridge?: boolean }> | undefined,
): OriginBridgeSettings {
  const { overrideExistingAndroidBridge: legacyOverride, ...cleanSettings } = settings ?? {};
  return {
    ...DEFAULT_SETTINGS,
    ...cleanSettings,
    overrideExistingBridge:
      cleanSettings.overrideExistingBridge ??
      legacyOverride ??
      DEFAULT_SETTINGS.overrideExistingBridge,
  };
}

function getActiveProfileState(
  originState: OriginScopedBridgeState,
): OriginBridgeProfileState {
  const profileId = getBridgeProfile(originState.activeProfileId).id;
  return originState.profiles[profileId] ?? createDefaultProfileState(profileId);
}

function isScopedOriginState(
  state: OriginScopedBridgeState | OriginBridgeProfileState,
): state is OriginScopedBridgeState {
  return "profiles" in state;
}

function normalizeSenders(senders: BridgeSender[]): BridgeSender[] {
  return normalizeSenderCollection(
    senders.map((sender) => {
      const responses = cloneJson(sender.responses ?? []);
      const legacySender = sender as BridgeSender & {
        enabled?: boolean;
        lastActiveResponseId?: string | null;
      };
      const legacyEnabled = legacySender.enabled ?? true;
      const nextSelection = normalizeResponseSelection(
        responses,
        legacyEnabled ? sender.activeResponseId : null,
        legacySender.lastActiveResponseId ?? sender.activeResponseId,
      );
      return {
        id: sender.id,
        name: sender.name,
        matchEvent: sender.matchEvent,
        responses,
        ...nextSelection,
        meta: sender.meta,
      };
    }),
  );
}
