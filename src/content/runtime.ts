import type {
  BridgeLogItem,
  BridgePanelSnapshot,
  BridgeStorageState,
  OriginBridgeState,
} from "../shared/bridgeTypes";
import { SOURCE_EXTENSION, STORAGE_KEY } from "../shared/constants";
import { createId } from "../shared/id";
import type {
  ContentEvent,
  ContentPortMessage,
  PageDispatchMessage,
  PageSettingsMessage,
} from "../shared/messageTypes";
import { cloneJson } from "../shared/json";
import { buildSnapshot, updateStorageState } from "../shared/storage";

export interface RuntimeState {
  origin: string;
  href: string;
  globalEnabled: boolean;
  originState: OriginBridgeState;
}

export interface ContentRuntime {
  port: chrome.runtime.Port;
  portConnected: boolean;
  state: RuntimeState | null;
  ready: Promise<void>;
  chain: Promise<unknown>;
}

export async function initializeRuntime(
  runtime: ContentRuntime,
): Promise<BridgePanelSnapshot> {
  const href = window.location.href;
  const origin = window.location.origin;
  const snapshot = await buildSnapshot(origin, href);
  setRuntimeSnapshot(runtime, snapshot, snapshot.settings.preserveLogs);

  if (!snapshot.settings.preserveLogs && snapshot.logs.length > 0) {
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

  const snapshot = await buildSnapshot(runtime.state.origin, runtime.state.href);
  setRuntimeSnapshot(runtime, snapshot, true);
  syncSettingsToPage(runtime);
  return getSnapshot(runtime);
}

export async function mutateRuntime(
  runtime: ContentRuntime,
  task: (state: RuntimeState) => Promise<void>,
): Promise<void> {
  runtime.chain = runtime.chain.then(async () => {
    if (!runtime.state || !runtime.portConnected) {
      return;
    }

    await task(runtime.state);
    if (!runtime.portConnected) {
      return;
    }
    await persistRuntime(runtime);
    if (!runtime.portConnected) {
      return;
    }
    publishSnapshot(runtime);
  });

  await runtime.chain;
}

export function appendLog(
  state: RuntimeState,
  input: Omit<BridgeLogItem, "id" | "timestamp">,
): BridgeLogItem[] {
  const nextLogs = [
    {
      id: createId("log"),
      timestamp: Date.now(),
      ...input,
    },
    ...state.originState.logs,
  ];
  return trimLogs(nextLogs, state.originState.settings.maxLogCount);
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
    senders: cloneJson(runtime.state.originState.senders),
    logs: cloneJson(runtime.state.originState.logs),
    settings: { ...runtime.state.originState.settings },
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
    originState: {
      senders: cloneJson(snapshot.senders),
      logs: includeLogs ? cloneJson(snapshot.logs) : [],
      settings: { ...snapshot.settings },
    },
  };
}

export function publishSnapshot(runtime: ContentRuntime): void {
  postContentEvent(runtime, { type: "SNAPSHOT", snapshot: getSnapshot(runtime) });
}

export async function syncRuntimeFromStorageChange(
  runtime: ContentRuntime,
  changes: Record<string, chrome.storage.StorageChange>,
  areaName: string,
): Promise<boolean> {
  if (!runtime.portConnected || areaName !== "local" || !changes[STORAGE_KEY]) {
    return false;
  }

  await reloadRuntimeSnapshot(runtime);
  if (!runtime.portConnected) {
    return false;
  }
  publishSnapshot(runtime);
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
      overrideExistingAndroidBridge:
        runtime.state.originState.settings.overrideExistingAndroidBridge,
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

export function postContentMessage(
  runtime: ContentRuntime,
  message: ContentPortMessage,
): void {
  if (!runtime.portConnected) {
    return;
  }
  runtime.port.postMessage(message);
}

export function postContentEvent(
  runtime: ContentRuntime,
  event: ContentEvent,
): void {
  postContentMessage(runtime, {
    type: "CONTENT_EVENT",
    event,
  });
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
