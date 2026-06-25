import type {
  BridgeLogItem,
  BridgePanelSnapshot,
  BridgeStorageState,
  OriginBridgeState,
} from "../shared/bridgeTypes";
import { SOURCE_EXTENSION } from "../shared/constants";
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
  const logs = snapshot.settings.preserveLogs ? snapshot.logs : [];

  runtime.state = {
    origin,
    href,
    globalEnabled: snapshot.globalEnabled,
    originState: {
      rules: snapshot.rules,
      logs,
      settings: snapshot.settings,
    },
  };

  if (!snapshot.settings.preserveLogs && snapshot.logs.length > 0) {
    await persistRuntime(runtime);
  }

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
    rules: cloneJson(runtime.state.originState.rules),
    logs: cloneJson(runtime.state.originState.logs),
    settings: { ...runtime.state.originState.settings },
  };
}

export function publishSnapshot(runtime: ContentRuntime): void {
  postContentEvent(runtime, { type: "SNAPSHOT", snapshot: getSnapshot(runtime) });
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
