import {
  BRIDGE_PROFILES,
  DEFAULT_BRIDGE_PROFILE_ID,
  getBridgeProfile,
  type BridgeProfileId,
} from "../shared/bridgeProfiles";
import {
  SOURCE_EXTENSION,
  SOURCE_PAGE,
} from "../shared/constants";
import type { PageRuntimeMessage } from "../shared/messageTypes";

interface InjectState {
  globalEnabled: boolean;
  profileId: BridgeProfileId;
  overrideExistingBridge: boolean;
}

type BridgeWindow = Window & Record<string, BridgePostMessageHost | undefined>;

const injectState: InjectState = {
  globalEnabled: true,
  profileId: DEFAULT_BRIDGE_PROFILE_ID,
  overrideExistingBridge: true,
};

const mockBridges: Partial<Record<string, BridgePostMessageHost>> = {};

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

function createMockBridge(): BridgePostMessageHost {
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

function getWindowBridge(hostObject: string): BridgePostMessageHost | undefined {
  return (window as unknown as BridgeWindow)[hostObject];
}

function setWindowBridge(
  hostObject: string,
  bridge: BridgePostMessageHost | undefined,
): void {
  const bridgeWindow = window as unknown as BridgeWindow;
  if (bridge) {
    bridgeWindow[hostObject] = bridge;
    return;
  }

  delete bridgeWindow[hostObject];
}

function getOriginalBridges(): Partial<Record<string, BridgePostMessageHost>> {
  const stored = window.__H5_BRIDGE_ORIGINAL_BRIDGES__ ?? {};
  BRIDGE_PROFILES.forEach(({ hostObject }) => {
    const bridge = getWindowBridge(hostObject);
    if (!stored[hostObject] && bridge?.postMessage) {
      stored[hostObject] = bridge;
    }
  });
  window.__H5_BRIDGE_ORIGINAL_BRIDGES__ = stored;
  return stored;
}

function getMockBridge(hostObject: string): BridgePostMessageHost {
  if (!mockBridges[hostObject]) {
    mockBridges[hostObject] = createMockBridge();
  }
  return mockBridges[hostObject]!;
}

function shouldUseOriginalBridge(hostObject: string): boolean {
  const originalBridge = getOriginalBridges()[hostObject];
  return Boolean(
    originalBridge?.postMessage &&
      (!injectState.globalEnabled || !injectState.overrideExistingBridge),
  );
}

function syncActiveBridge(hostObject: string): void {
  if (shouldUseOriginalBridge(hostObject)) {
    setWindowBridge(hostObject, getOriginalBridges()[hostObject]);
    return;
  }

  setWindowBridge(hostObject, getMockBridge(hostObject));
}

function restoreInactiveBridge(hostObject: string): void {
  const originalBridge = getOriginalBridges()[hostObject];
  if (originalBridge?.postMessage) {
    setWindowBridge(hostObject, originalBridge);
    return;
  }

  if (getWindowBridge(hostObject) === mockBridges[hostObject]) {
    setWindowBridge(hostObject, undefined);
  }
}

function syncBridgeBinding(): void {
  const activeHostObject = getBridgeProfile(injectState.profileId).hostObject;
  BRIDGE_PROFILES.forEach(({ hostObject }) => {
    if (hostObject === activeHostObject) {
      syncActiveBridge(hostObject);
      return;
    }
    restoreInactiveBridge(hostObject);
  });
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
  injectState.profileId = message.payload.profileId ?? DEFAULT_BRIDGE_PROFILE_ID;
  injectState.overrideExistingBridge = message.payload.overrideExistingBridge;
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

function installBridgeMock(): void {
  getOriginalBridges();
  if (window.__H5_BRIDGE_INJECT_MAIN_INSTALLED__) {
    syncBridgeBinding();
    return;
  }

  window.__H5_BRIDGE_INJECT_MAIN_INSTALLED__ = true;
  syncBridgeBinding();
  window.addEventListener("message", handleExtensionMessage);
}

installBridgeMock();
