import { cloneJson } from "../shared/json";
import type {
  BackgroundToPanelMessage,
  PanelPortMessage,
} from "../shared/messageTypes";
import { applyPreviewCommand, createPreviewSnapshot } from "./previewState";

type PortListener = (message: BackgroundToPanelMessage) => void;
type DisconnectListener = () => void;

let previewSnapshot = createPreviewSnapshot();

export function installPreviewChrome(): void {
  const runtime = {
    connect() {
      return createPort();
    },
  };

  const devtools = {
    inspectedWindow: { tabId: 1 },
  };

  (globalThis as typeof globalThis & { chrome: typeof chrome }).chrome = {
    runtime,
    devtools,
  } as unknown as typeof chrome;
}

function createPort(): chrome.runtime.Port {
  const listeners = new Set<PortListener>();
  const disconnectListeners = new Set<DisconnectListener>();

  return {
    name: "preview-port",
    onMessage: {
      addListener(listener) {
        listeners.add(listener as PortListener);
      },
      removeListener(listener) {
        listeners.delete(listener as PortListener);
      },
      hasListener(listener) {
        return listeners.has(listener as PortListener);
      },
      hasListeners() {
        return listeners.size > 0;
      },
    },
    onDisconnect: {
      addListener(listener) {
        disconnectListeners.add(listener as DisconnectListener);
      },
      removeListener(listener) {
        disconnectListeners.delete(listener as DisconnectListener);
      },
      hasListener(listener) {
        return disconnectListeners.has(listener as DisconnectListener);
      },
      hasListeners() {
        return disconnectListeners.size > 0;
      },
    },
    postMessage(message: PanelPortMessage) {
      handlePortMessage(message, listeners);
    },
    disconnect() {
      disconnectListeners.forEach((listener) => listener());
    },
    sender: undefined,
  } as chrome.runtime.Port;
}

function handlePortMessage(
  message: PanelPortMessage,
  listeners: Set<PortListener>,
): void {
  if (message.type === "PANEL_INIT") {
    emitSnapshot(listeners);
    return;
  }

  previewSnapshot = applyPreviewCommand(previewSnapshot, message.command, (eventName, detail) => {
    window.dispatchEvent(new CustomEvent(eventName, { detail }));
  });
  emitSnapshot(listeners);
}

function emitSnapshot(listeners: Set<PortListener>): void {
  const payload: BackgroundToPanelMessage = {
    type: "BACKGROUND_EVENT",
    event: {
      type: "SNAPSHOT",
      snapshot: cloneJson(previewSnapshot),
    },
  };
  listeners.forEach((listener) => listener(payload));
}
