import type {
  BridgeLogItem,
  BridgePanelSnapshot,
  BridgeStorageState,
  OriginBridgeProfileState,
  OriginScopedBridgeState,
} from "../shared/bridgeTypes";
import { SOURCE_EXTENSION, STORAGE_KEY } from "../shared/constants";
import type { PageDispatchMessage, PageSettingsMessage, PanelCommandResponse, ApplyStateCommandRequest } from "../shared/messageTypes";
import { cloneJson } from "../shared/json";
import { createId } from "../shared/id";
import {
  applyCommandToRuntimeState,
  type StateCommand,
} from "../shared/stateCommands";
import {
  createDefaultOriginState,
  getOriginProfile,
  persistOriginScopedState,
  readOriginScopedState,
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
  /** 串行执行镜像更新的链；单次失败会被吞掉以保持链可用（H1 恢复）。 */
  chain: Promise<void>;
}

export async function initializeRuntime(runtime: ContentRuntime): Promise<void> {
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
    await persistOriginScopedState(origin, runtime.state.globalEnabled, originState);
  }

  syncSettingsToPage(runtime);
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

/**
 * 把确定性的状态增量命令应用到本地镜像，并交给后台串行写入存储。
 * 命令由调用方完整物化（id/时间戳在命令里），两边应用同一命令后收敛。
 */
export async function applyCommand(
  runtime: ContentRuntime,
  command: StateCommand,
): Promise<void> {
  const work = runtime.chain.then(async () => {
    if (!runtime.state) {
      return;
    }
    applyCommandToRuntimeState(runtime.state, command);
    await persistCommand(runtime, command);
  });
  runtime.chain = work.catch((error: unknown) => {
    console.warn("[H5Bridge] 状态持久化失败，将在后续写入时重试。", error);
  });
  await work;
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
    activeProfile: getOriginProfile(
      runtime.state.originState,
      runtime.state.originState.activeProfileId,
    ),
    profiles: Object.values(runtime.state.originState.profileDefinitions).map((profile) => ({
      ...profile,
    })),
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
  if (areaName !== "local" || !changes[STORAGE_KEY] || !runtime.state) {
    return false;
  }

  const change = changes[STORAGE_KEY];
  if (!didRelevantSliceChange(change, runtime.state.origin)) {
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
      profile: getOriginProfile(
        runtime.state.originState,
        runtime.state.originState.activeProfileId,
      ),
      knownHostObjects: runtime.state.originState.knownHostObjects,
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

export function readEventName(
  parsedMessage: unknown,
  requestEventField = "event",
): string | undefined {
  if (!parsedMessage || typeof parsedMessage !== "object") {
    return undefined;
  }

  const eventName = Reflect.get(parsedMessage, requestEventField);
  return typeof eventName === "string" ? eventName : undefined;
}

export function getActiveProfileState(
  state: RuntimeState,
): OriginBridgeProfileState {
  return state.originState.profiles[state.originState.activeProfileId];
}

export function createLogEntry(
  input: Omit<BridgeLogItem, "id" | "timestamp">,
): BridgeLogItem {
  return {
    id: createId("log"),
    timestamp: Date.now(),
    ...input,
  };
}

async function persistCommand(
  runtime: ContentRuntime,
  command: StateCommand,
): Promise<void> {
  const message: ApplyStateCommandRequest = {
    type: "APPLY_STATE_COMMAND",
    origin: runtime.state?.origin ?? "",
    command,
  };
  const response = (await chrome.runtime.sendMessage(message)) as
    | PanelCommandResponse
    | undefined;
  if (!response?.ok) {
    throw new Error(response?.message ?? "状态写入失败");
  }
}

function didRelevantSliceChange(
  change: chrome.storage.StorageChange,
  origin: string,
): boolean {
  const before = (change.oldValue as BridgeStorageState | undefined);
  const after = (change.newValue as BridgeStorageState | undefined);
  if ((before?.globalEnabled ?? true) !== (after?.globalEnabled ?? true)) {
    return true;
  }

  const beforeSlice = before?.origins?.[origin];
  const afterSlice = after?.origins?.[origin];
  return JSON.stringify(beforeSlice) !== JSON.stringify(afterSlice);
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
    profileDefinitions: {
      ...baseState.profileDefinitions,
      [snapshot.activeProfile.id]: { ...snapshot.activeProfile },
    },
    knownHostObjects: Array.from(
      new Set([...baseState.knownHostObjects, snapshot.activeProfile.hostObject]),
    ),
    profiles: {
      ...baseState.profiles,
      [snapshot.activeProfileId]: nextProfileState,
    },
  };
}
