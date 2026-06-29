import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSender, createSnapshot } from "../test/factories";
import {
  appendLog,
  getSnapshot,
  initializeRuntime,
  mutateRuntime,
  setRuntimeSnapshot,
  syncRuntimeFromStorageChange,
  type ContentRuntime,
} from "./runtime";

type StorageListener = (
  changes: Record<string, chrome.storage.StorageChange>,
  areaName: string,
) => void | Promise<boolean>;

const origin = "https://example.com";
let storageBucket: Record<string, unknown>;
let storageListeners: Set<StorageListener>;

function createRuntime(): ContentRuntime {
  return {
    state: null,
    ready: Promise.resolve(),
    chain: Promise.resolve(),
  };
}

beforeEach(() => {
  storageBucket = {};
  storageListeners = new Set<StorageListener>();
  installChromeStorageMock();
  setWindowLocation(`${origin}/page-a`);
});

describe("setRuntimeSnapshot", () => {
  it("初始化时可按设置忽略已持久化日志", () => {
    const runtime = createRuntime();
    const snapshot = createSnapshot({
      logs: [{ id: "log-1", type: "SEND", timestamp: 1, event: "openCamera" }],
      settings: {
        autoMock: true,
        preserveLogs: false,
        maxLogCount: 200,
        overrideExistingAndroidBridge: true,
      },
    });

    setRuntimeSnapshot(runtime, snapshot, false);

    expect(runtime.state?.originState.logs).toEqual([]);
  });

  it("实时同步时会保留共享日志", () => {
    const runtime = createRuntime();
    const snapshot = createSnapshot({
      logs: [{ id: "log-1", type: "MOCK", timestamp: 2, event: "openCamera" }],
    });

    setRuntimeSnapshot(runtime, snapshot, true);

    expect(runtime.state?.originState.logs).toEqual(snapshot.logs);
  });
});

describe("shared storage sync", () => {
  it("同 origin 的第二个 runtime 会在存储变化后自动刷新快照", async () => {
    const runtimeA = createRuntime();
    const runtimeB = createRuntime();
    const syncListener = (
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: string,
    ) => syncRuntimeFromStorageChange(runtimeB, changes, areaName);

    setWindowLocation(`${origin}/page-a`);
    await initializeRuntime(runtimeA);
    setWindowLocation(`${origin}/page-b`);
    await initializeRuntime(runtimeB);
    chrome.storage.onChanged.addListener(syncListener as never);

    const sharedSender = createSender("sender-shared", { name: "跨页新增发送" });
    await mutateRuntime(runtimeA, async (state) => {
      state.originState.senders = [...state.originState.senders, sharedSender];
      state.originState.logs = appendLog(state, {
        type: "SEND",
        event: "openCamera",
        payload: { success: true },
      });
    });

    const syncedSnapshot = getSnapshot(runtimeB);

    expect(syncedSnapshot.href).toBe(`${origin}/page-b`);
    expect(syncedSnapshot.senders.some((sender) => sender.id === sharedSender.id)).toBe(true);
    expect(syncedSnapshot.logs[0]?.event).toBe("openCamera");
  });
});

function cloneValue<T>(value: T): T {
  return value === undefined ? value : JSON.parse(JSON.stringify(value)) as T;
}

function installChromeStorageMock(): void {
  const local = {
    async get(key: string) {
      return { [key]: cloneValue(storageBucket[key]) };
    },
    async set(items: Record<string, unknown>) {
      const changes: Record<string, chrome.storage.StorageChange> = {};
      for (const [key, value] of Object.entries(items)) {
        changes[key] = {
          oldValue: cloneValue(storageBucket[key]),
          newValue: cloneValue(value),
        };
        storageBucket[key] = cloneValue(value);
      }

      await Promise.all(
        Array.from(storageListeners, (listener) => listener(changes, "local")),
      );
    },
  };

  const onChanged = {
    addListener(listener: StorageListener) {
      storageListeners.add(listener);
    },
    removeListener(listener: StorageListener) {
      storageListeners.delete(listener);
    },
    hasListener(listener: StorageListener) {
      return storageListeners.has(listener);
    },
    hasListeners() {
      return storageListeners.size > 0;
    },
  };

  (globalThis as typeof globalThis & { chrome: typeof chrome }).chrome = {
    storage: {
      local,
      onChanged,
    },
  } as unknown as typeof chrome;
}

function setWindowLocation(href: string): void {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      location: {
        origin,
        href,
      },
      postMessage: vi.fn(),
    },
  });
}
