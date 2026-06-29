import type { BridgePanelSnapshot } from "../shared/bridgeTypes";
import type {
  BackgroundToContentMessage,
  PageBridgeCallMessage,
} from "../shared/messageTypes";
import type { ContentRuntime } from "./runtime";

const CONTENT_PORT_NAME = "h5-bridge-content";
const RECONNECT_DELAY_MS = 60;

export interface ContentConnectionHandlers {
  initialize: () => Promise<BridgePanelSnapshot>;
  onPortMessage: (message: BackgroundToContentMessage) => void | Promise<unknown>;
  onStorageChange: (
    changes: Record<string, chrome.storage.StorageChange>,
    areaName: string,
  ) => void | Promise<unknown>;
  onWindowMessage: (
    event: MessageEvent<PageBridgeCallMessage>,
  ) => void | Promise<unknown>;
}

export function createContentRuntime(): ContentRuntime {
  return {
    port: chrome.runtime.connect({ name: CONTENT_PORT_NAME }),
    portConnected: true,
    state: null,
    ready: Promise.resolve(),
    chain: Promise.resolve(),
  };
}

export function bindContentRuntime(
  runtime: ContentRuntime,
  handlers: ContentConnectionHandlers,
): void {
  let reconnectTimer: number | null = null;

  const scheduleReconnect = () => {
    if (reconnectTimer !== null || !hasActiveExtensionRuntime(chrome.runtime)) {
      return;
    }

    reconnectTimer = window.setTimeout(() => {
      reconnectTimer = null;
      const port = reconnectContentPort();
      if (!port) {
        return;
      }
      attachPort(runtime, port, handlers, scheduleReconnect);
    }, RECONNECT_DELAY_MS);
  };

  attachPort(runtime, runtime.port, handlers, scheduleReconnect);
}

function attachPort(
  runtime: ContentRuntime,
  port: chrome.runtime.Port,
  handlers: ContentConnectionHandlers,
  scheduleReconnect: () => void,
): void {
  runtime.port = port;
  runtime.portConnected = true;
  runtime.ready = handlers.initialize().then((snapshot) => {
    if (!isActivePort(runtime, port)) {
      return;
    }
    port.postMessage({ type: "CONTENT_READY", snapshot });
  });

  const handlePortMessage = (message: BackgroundToContentMessage) => {
    void runWhenReady(runtime, port, () => handlers.onPortMessage(message));
  };
  const handleStorageChange = (
    changes: Record<string, chrome.storage.StorageChange>,
    areaName: string,
  ) => {
    void runWhenReady(runtime, port, () => handlers.onStorageChange(changes, areaName));
  };
  const handleWindowMessage = (event: MessageEvent<PageBridgeCallMessage>) => {
    void runWhenReady(runtime, port, () => handlers.onWindowMessage(event));
  };
  const handleDisconnect = () => {
    port.onMessage.removeListener(handlePortMessage);
    port.onDisconnect.removeListener(handleDisconnect);
    chrome.storage.onChanged.removeListener(handleStorageChange);
    window.removeEventListener("message", handleWindowMessage);
    if (!isActivePort(runtime, port)) {
      return;
    }

    runtime.portConnected = false;
    scheduleReconnect();
  };

  port.onMessage.addListener(handlePortMessage);
  port.onDisconnect.addListener(handleDisconnect);
  chrome.storage.onChanged.addListener(handleStorageChange);
  window.addEventListener("message", handleWindowMessage);
}

async function runWhenReady(
  runtime: ContentRuntime,
  port: chrome.runtime.Port,
  task: () => void | Promise<unknown>,
): Promise<void> {
  await runtime.ready;
  if (!isActivePort(runtime, port)) {
    return;
  }
  await task();
}

function reconnectContentPort(): chrome.runtime.Port | null {
  try {
    return chrome.runtime.connect({ name: CONTENT_PORT_NAME });
  } catch (error) {
    if (isExtensionContextInvalidatedError(error)) {
      return null;
    }
    throw error;
  }
}

function isActivePort(runtime: ContentRuntime, port: chrome.runtime.Port): boolean {
  return runtime.portConnected && runtime.port === port;
}

function hasActiveExtensionRuntime(
  runtime: Partial<Pick<typeof chrome.runtime, "connect" | "id">> | undefined,
): runtime is Pick<typeof chrome.runtime, "connect" | "id"> {
  return typeof runtime?.connect === "function" && typeof runtime.id === "string" && runtime.id.length > 0;
}

function isExtensionContextInvalidatedError(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.message.includes("Extension context invalidated")
  );
}
