import type {
  BridgeLogItem,
  BridgePanelSnapshot,
  BridgeStorageState,
  OriginBridgeProfileState,
  OriginScopedBridgeState,
} from "../shared/bridgeTypes";
import { getBridgeProfile, type BridgeProfileId } from "../shared/bridgeProfiles";
import { SOURCE_EXTENSION, STORAGE_KEY } from "../shared/constants";
import { createId } from "../shared/id";
import type { PageDispatchMessage, PageSettingsMessage } from "../shared/messageTypes";
import { cloneJson } from "../shared/json";
import {
  createDefaultOriginState,
  readOriginScopedState,
  updateStorageState,
} from "../shared/storage";

export interface RuntimeState {
  origin: string;
  href: string;
  globalEnabled: boolean;
  originState: OriginScopedBridgeState;
}

export interface ContentRuntime {
  state: RuntimeState | null;
  ready: Promise<void>;
  chain: Promise<unknown>;
}

export async function initializeRuntime(
  runtime: ContentRuntime,
): Promise<BridgePanelSnapshot> {
  const href = window.location.href;
  const origin = window.location.origin;
  const { globalEnabled, originState } = await readOriginScopedState(origin);
  runtime.state = {
    origin,
    href,
    globalEnabled,
    originState,
  };
  const profileState = getActiveProfileState(runtime.state);
  const preserveLogs = profileState.settings.preserveLogs;
  const hasLogs = profileState.logs.length > 0;

  if (!preserveLogs) {
    profileState.logs = [];
  }

  if (!preserveLogs && hasLogs) {
    await persistRuntime(runtime);
  }

  syncSettingsToPage(runtime);
  return getSnapshot(runtime);
}

export async function reloadRuntimeSnapshot(
  runtime: ContentRuntime,
): Promise<BridgePanelSnapshot> {
  if (!runtime.state) {
    throw new Error("Runtime state is not initialized.");
  }

  const { globalEnabled, originState } = await readOriginScopedState(runtime.state.origin);
  runtime.state = {
    origin: runtime.state.origin,
    href: runtime.state.href,
    globalEnabled,
    originState,
  };
  syncSettingsToPage(runtime);
  return getSnapshot(runtime);
}

export async function mutateRuntime(
  runtime: ContentRuntime,
  task: (state: RuntimeState) => Promise<void>,
): Promise<void> {
  runtime.chain = runtime.chain.then(async () => {
    if (!runtime.state) {
      return;
    }

    await task(runtime.state);
    await persistRuntime(runtime);
  });

  await runtime.chain;
}

export function appendLog(
  state: RuntimeState,
  input: Omit<BridgeLogItem, "id" | "timestamp">,
): BridgeLogItem[] {
  const profileState = getActiveProfileState(state);
  const nextLogs = [
    {
      id: createId("log"),
      timestamp: Date.now(),
      ...input,
    },
    ...profileState.logs,
  ];
  return trimLogs(nextLogs, profileState.settings.maxLogCount);
}

export function trimLogs(
  logs: BridgeLogItem[],
  maxLogCount: number,
): BridgeLogItem[] {
  return logs.slice(0, Math.max(1, maxLogCount));
}

export function getSnapshot(runtime: ContentRuntime): BridgePanelSnapshot {
  if (!runtime.state) {
    throw new Error("Runtime state is not initialized.");
  }

  return {
    origin: runtime.state.origin,
    href: runtime.state.href,
    globalEnabled: runtime.state.globalEnabled,
    activeProfileId: runtime.state.originState.activeProfileId,
    senders: cloneJson(getActiveProfileState(runtime.state).senders),
    logs: cloneJson(getActiveProfileState(runtime.state).logs),
    settings: { ...getActiveProfileState(runtime.state).settings },
  };
}

export function setRuntimeSnapshot(
  runtime: ContentRuntime,
  snapshot: BridgePanelSnapshot,
  includeLogs: boolean,
): void {
  runtime.state = {
    origin: snapshot.origin,
    href: snapshot.href,
    globalEnabled: snapshot.globalEnabled,
    originState: mergeSnapshotIntoOriginState(snapshot, includeLogs, runtime.state?.originState),
  };
}

export async function syncRuntimeFromStorageChange(
  runtime: ContentRuntime,
  changes: Record<string, chrome.storage.StorageChange>,
  areaName: string,
): Promise<boolean> {
  if (areaName !== "local" || !changes[STORAGE_KEY]) {
    return false;
  }

  await reloadRuntimeSnapshot(runtime);
  return true;
}

export function syncSettingsToPage(runtime: ContentRuntime): void {
  if (!runtime.state) {
    return;
  }

  const payload: PageSettingsMessage = {
    source: SOURCE_EXTENSION,
    type: "SYNC_SETTINGS",
    payload: {
      globalEnabled: runtime.state.globalEnabled,
      profileId: runtime.state.originState.activeProfileId,
      overrideExistingBridge: getActiveProfileState(runtime.state).settings.overrideExistingBridge,
    },
  };
  window.postMessage(payload, "*");
}

export function dispatchToPage(eventName: string, detail: unknown): void {
  const payload: PageDispatchMessage = {
    source: SOURCE_EXTENSION,
    type: "DISPATCH_EVENT",
    payload: {
      eventName,
      detail,
    },
  };
  window.postMessage(payload, "*");
}

export function readEventName(parsedMessage: unknown): string | undefined {
  if (!parsedMessage || typeof parsedMessage !== "object") {
    return undefined;
  }

  const eventName = Reflect.get(parsedMessage, "event");
  return typeof eventName === "string" ? eventName : undefined;
}

async function persistRuntime(runtime: ContentRuntime): Promise<void> {
  if (!runtime.state) {
    return;
  }

  const activeState = runtime.state;
  await updateStorageState((state: BridgeStorageState) => ({
    ...state,
    globalEnabled: activeState.globalEnabled,
    origins: {
      ...state.origins,
      [activeState.origin]: cloneJson(activeState.originState),
    },
  }));
}

export function setActiveProfile(
  state: RuntimeState,
  profileId: BridgeProfileId,
): void {
  state.originState.activeProfileId = getBridgeProfile(profileId).id;
}

export function getActiveProfileState(
  state: RuntimeState,
): OriginBridgeProfileState {
  return state.originState.profiles[state.originState.activeProfileId];
}

function mergeSnapshotIntoOriginState(
  snapshot: BridgePanelSnapshot,
  includeLogs: boolean,
  previousState: OriginScopedBridgeState | undefined,
): OriginScopedBridgeState {
  const baseState = previousState
    ? cloneJson(previousState)
    : createDefaultOriginState();
  const nextProfileState: OriginBridgeProfileState = {
    senders: cloneJson(snapshot.senders),
    logs: includeLogs ? cloneJson(snapshot.logs) : [],
    settings: { ...snapshot.settings },
  };
  return {
    ...baseState,
    activeProfileId: snapshot.activeProfileId,
    profiles: {
      ...baseState.profiles,
      [snapshot.activeProfileId]: nextProfileState,
    },
  };
}
