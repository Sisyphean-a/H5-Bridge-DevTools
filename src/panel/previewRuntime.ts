import type {
  BridgePanelSnapshot,
  BridgeStorageState,
  OriginBridgeProfileState,
  OriginScopedBridgeState,
} from "../shared/bridgeTypes";
import { STORAGE_KEY } from "../shared/constants";
import { cloneJson } from "../shared/json";
import type {
  PanelCommandRequest,
  PanelCommandResponse,
} from "../shared/messageTypes";
import { createDefaultOriginState } from "../shared/storage";
import { applyPreviewCommand, createPreviewSnapshot } from "./previewState";

type StorageListener = (
  changes: Record<string, chrome.storage.StorageChange>,
  areaName: string,
) => void;
interface TabUpdateInfo {
  status?: string;
  url?: string;
}
type TabUpdatedListener = (
  tabId: number,
  changeInfo: TabUpdateInfo,
  tab: chrome.tabs.Tab,
) => void;
type TabRemovedListener = (tabId: number) => void;

let previewSnapshot = createPreviewSnapshot();
const storageListeners = new Set<StorageListener>();
const tabUpdatedListeners = new Set<TabUpdatedListener>();
const tabRemovedListeners = new Set<TabRemovedListener>();
let storageState = createPreviewStorageState(previewSnapshot);

export function installPreviewChrome(): void {
  const runtime = {
    id: "preview-extension",
    async sendMessage(message: PanelCommandRequest): Promise<PanelCommandResponse> {
      if (message.type !== "PANEL_COMMAND") {
        return { ok: false, message: "Unsupported preview message." };
      }

      const nextSnapshot = applyPreviewCommand(
        previewSnapshot,
        message.command,
        (eventName: string, detail: unknown) => {
          window.dispatchEvent(new CustomEvent(eventName, { detail }));
        },
      );

      updatePreviewSnapshot(nextSnapshot);
      return { ok: true };
    },
  };

  const tabs = {
    async get(tabId: number) {
      if (tabId !== 1) {
        throw new Error(`Unknown preview tab: ${tabId}`);
      }

      return {
        id: 1,
        status: "complete",
        url: previewSnapshot.href,
      } as chrome.tabs.Tab;
    },
    onUpdated: createListenerApi(tabUpdatedListeners),
    onRemoved: createListenerApi(tabRemovedListeners),
  };

  const storage = {
    local: {
      async get(key: string) {
        return { [key]: cloneJson((storageState as Record<string, unknown>)[key]) };
      },
      async set(items: Record<string, unknown>) {
        const changes: Record<string, chrome.storage.StorageChange> = {};
        for (const [key, value] of Object.entries(items)) {
          const previousValue = cloneJson((storageState as Record<string, unknown>)[key]);
          (storageState as Record<string, unknown>)[key] = cloneJson(value);
          changes[key] = {
            oldValue: previousValue,
            newValue: cloneJson(value),
          };
        }

        storageListeners.forEach((listener) => listener(changes, "local"));
      },
    },
    onChanged: createListenerApi(storageListeners),
  };

  const devtools = {
    inspectedWindow: { tabId: 1 },
  };

  (globalThis as typeof globalThis & { chrome: typeof chrome }).chrome = {
    runtime,
    tabs,
    storage,
    devtools,
  } as unknown as typeof chrome;
}

function createPreviewStorageState(snapshot: BridgePanelSnapshot): {
  [STORAGE_KEY]: BridgeStorageState;
} {
  const originState: OriginScopedBridgeState = createDefaultOriginState();
  const activeProfileState: OriginBridgeProfileState = {
    senders: cloneJson(snapshot.senders),
    logs: cloneJson(snapshot.logs),
    settings: { ...snapshot.settings },
  };
  originState.activeProfileId = snapshot.activeProfileId;
  originState.profiles[snapshot.activeProfileId] = activeProfileState;

  return {
    [STORAGE_KEY]: {
      globalEnabled: snapshot.globalEnabled,
      origins: {
        [snapshot.origin]: originState,
      },
    },
  };
}

function createListenerApi<TListener>(listeners: Set<TListener>) {
  return {
    addListener(listener: TListener) {
      listeners.add(listener);
    },
    removeListener(listener: TListener) {
      listeners.delete(listener);
    },
    hasListener(listener: TListener) {
      return listeners.has(listener);
    },
    hasListeners() {
      return listeners.size > 0;
    },
  };
}

function updatePreviewSnapshot(snapshot: BridgePanelSnapshot): void {
  const previousState = cloneJson(storageState[STORAGE_KEY]);
  previewSnapshot = snapshot;
  storageState = createPreviewStorageState(snapshot);
  storageListeners.forEach((listener) =>
    listener(
      {
        [STORAGE_KEY]: {
          oldValue: previousState,
          newValue: cloneJson(storageState[STORAGE_KEY]),
        },
      },
      "local",
    ),
  );
}
