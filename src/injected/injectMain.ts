import {
  BRIDGE_PROFILES,
  getBridgeProfile,
  isBridgeHostObjectName,
  isBridgeProfile,
  type BridgeProfile,
} from "../shared/bridgeProfiles";
import { SOURCE_EXTENSION, SOURCE_PAGE } from "../shared/constants";
import type { PageRuntimeMessage } from "../shared/messageTypes";

interface InjectState {
  globalEnabled: boolean;
  profile: BridgeProfile;
  knownHostObjects: string[];
  overrideExistingBridge: boolean;
}

type BridgeWindow = Window & Record<string, BridgePostMessageHost | undefined>;

const injectState: InjectState = {
  globalEnabled: true,
  profile: getBridgeProfile(undefined),
  knownHostObjects: BRIDGE_PROFILES.map((profile) => profile.hostObject),
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

function setWindowBridge(hostObject: string, bridge: BridgePostMessageHost | undefined): void {
  const bridgeWindow = window as unknown as BridgeWindow;
  if (bridge) {
    bridgeWindow[hostObject] = bridge;
    return;
  }

  delete bridgeWindow[hostObject];
}

function getOriginalBridges(): Partial<Record<string, BridgePostMessageHost>> {
  const stored = window.__H5_BRIDGE_ORIGINAL_BRIDGES__ ?? {};
  window.__H5_BRIDGE_ORIGINAL_BRIDGES__ = stored;
  return stored;
}

function isManageableBridgeHost(hostObject: string): boolean {
  const bridge = (window as unknown as Record<string, unknown>)[hostObject];
  return (
    bridge === undefined ||
    bridge === mockBridges[hostObject] ||
    (typeof bridge === "object" &&
      bridge !== null &&
      typeof Reflect.get(bridge, "postMessage") === "function")
  );
}

function rememberOriginalBridge(hostObject: string): void {
  const originals = getOriginalBridges();
  const bridge = getWindowBridge(hostObject);
  if (!originals[hostObject] && bridge?.postMessage && bridge !== mockBridges[hostObject]) {
    originals[hostObject] = bridge;
  }
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
  const hostObjects = new Set([...injectState.knownHostObjects, injectState.profile.hostObject]);
  for (const hostObject of hostObjects) {
    rememberOriginalBridge(hostObject);
    if (hostObject === injectState.profile.hostObject) {
      syncActiveBridge(hostObject);
    } else {
      restoreInactiveBridge(hostObject);
    }
  }
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

  const { profile, knownHostObjects, globalEnabled, overrideExistingBridge } = message.payload;
  if (
    !isBridgeProfile(profile) ||
    !Array.isArray(knownHostObjects) ||
    !knownHostObjects.every(
      (hostObject): hostObject is string =>
        typeof hostObject === "string" && isBridgeHostObjectName(hostObject),
    ) ||
    typeof globalEnabled !== "boolean" ||
    typeof overrideExistingBridge !== "boolean" ||
    !isManageableBridgeHost(profile.hostObject)
  ) {
    return;
  }

  injectState.globalEnabled = globalEnabled;
  injectState.profile = profile;
  injectState.knownHostObjects = Array.from(
    new Set([...injectState.knownHostObjects, ...knownHostObjects, profile.hostObject]),
  );
  injectState.overrideExistingBridge = overrideExistingBridge;
  syncBridgeBinding();
}

function handleExtensionMessage(event: MessageEvent<PageRuntimeMessage>): void {
  if (event.source !== window || !event.data || event.data.source !== SOURCE_EXTENSION) {
    return;
  }

  handleDispatchMessage(event.data);
  handleSettingsMessage(event.data);
}

function installBridgeMock(): void {
  syncBridgeBinding();
  if (window.__H5_BRIDGE_INJECT_MAIN_INSTALLED__) {
    return;
  }

  window.__H5_BRIDGE_INJECT_MAIN_INSTALLED__ = true;
  window.addEventListener("message", handleExtensionMessage);
}

installBridgeMock();
