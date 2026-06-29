import {
  SOURCE_EXTENSION,
  SOURCE_PAGE,
} from "../shared/constants";
import type { PageRuntimeMessage } from "../shared/messageTypes";

interface InjectState {
  globalEnabled: boolean;
  overrideExistingAndroidBridge: boolean;
}

const injectState: InjectState = {
  globalEnabled: true,
  overrideExistingAndroidBridge: true,
};

const originalBridge = window.AndroidBridge?.postMessage
  ? window.AndroidBridge
  : undefined;

function parseBridgeMessage(message: unknown): unknown {
  if (typeof message !== "string") {
    return message;
  }

  try {
    return JSON.parse(message);
  } catch {
    return null;
  }
}

function createMockBridge() {
  return {
    postMessage(message: unknown) {
      window.postMessage(
        {
          source: SOURCE_PAGE,
          type: "BRIDGE_CALL",
          payload: {
            rawMessage: message,
            parsedMessage: parseBridgeMessage(message),
          },
        },
        "*",
      );
    },
  };
}

function shouldUseOriginalBridge(): boolean {
  return Boolean(
    originalBridge?.postMessage &&
      (!injectState.globalEnabled || !injectState.overrideExistingAndroidBridge),
  );
}

function syncBridgeBinding(): void {
  if (shouldUseOriginalBridge()) {
    window.AndroidBridge = originalBridge;
    return;
  }

  window.AndroidBridge = createMockBridge();
}

function handleDispatchMessage(message: PageRuntimeMessage): void {
  if (message.type !== "DISPATCH_EVENT") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent(message.payload.eventName, {
      detail: message.payload.detail,
    }),
  );
}

function handleSettingsMessage(message: PageRuntimeMessage): void {
  if (message.type !== "SYNC_SETTINGS") {
    return;
  }

  injectState.globalEnabled = message.payload.globalEnabled;
  injectState.overrideExistingAndroidBridge =
    message.payload.overrideExistingAndroidBridge;
  syncBridgeBinding();
}

function handleExtensionMessage(event: MessageEvent<PageRuntimeMessage>): void {
  if (event.source !== window) {
    return;
  }
  if (!event.data || event.data.source !== SOURCE_EXTENSION) {
    return;
  }

  handleDispatchMessage(event.data);
  handleSettingsMessage(event.data);
}

function installAndroidBridgeMock(): void {
  if (window.__H5_BRIDGE_INJECT_MAIN_INSTALLED__) {
    syncBridgeBinding();
    return;
  }

  window.__H5_BRIDGE_INJECT_MAIN_INSTALLED__ = true;
  if (originalBridge?.postMessage) {
    window.__H5_BRIDGE_ORIGINAL_ANDROID_BRIDGE__ = originalBridge;
  }

  syncBridgeBinding();
  window.addEventListener("message", handleExtensionMessage);
}

installAndroidBridgeMock();
