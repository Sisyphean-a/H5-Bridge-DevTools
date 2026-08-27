import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSnapshot } from "../test/factories";
import { applyCommandToRuntimeState, type StateCommand } from "../shared/stateCommands";
import { STORAGE_KEY } from "../shared/constants";
import { createDefaultOriginState } from "../shared/storage";
import type { BridgeStorageState } from "../shared/bridgeTypes";
import {
  applyCommand,
  getActiveProfileState,
  getSnapshot,
  initializeRuntime,
  readEventName,
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
let sendMessageMock: ReturnType<typeof vi.fn>;

function createRuntime(): ContentRuntime {
  return {
    state: null,
    ready: Promise.resolve(),
    chain: Promise.resolve(),
  };
}

function createSendLog(event: string, payload: unknown = { ok: true }): StateCommand {
  return {
    type: "APPEND_LOG",
    log: {
      id: `log-${Math.random().toString(36).slice(2)}`,
      timestamp: Date.now(),
      type: "SEND",
      event,
      payload,
    },
  };
}

beforeEach(() => {
  storageBucket = {};
  storageListeners = new Set<StorageListener>();
  installChromeMocks();
  setWindowLocation(`${origin}/page-a`);
});

describe("readEventName", () => {
  it("按方案指定的请求事件字段读取消息", () => {
    expect(readEventName({ eg18Code: "startLogin" }, "eg18Code")).toBe("startLogin");
    expect(readEventName({ eg18Code: "startLogin" })).toBeUndefined();
  });
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
        overrideExistingBridge: true,
      },
    });

    setRuntimeSnapshot(runtime, snapshot, false);

    expect(runtime.state && getActiveProfileState(runtime.state).logs).toEqual([]);
  });

  it("实时同步时会保留共享日志", () => {
    const runtime = createRuntime();
    const snapshot = createSnapshot({
      logs: [{ id: "log-1", type: "MOCK", timestamp: 2, event: "openCamera" }],
    });

    setRuntimeSnapshot(runtime, snapshot, true);

    expect(runtime.state && getActiveProfileState(runtime.state).logs).toEqual(snapshot.logs);
  });
});

describe("initializeRuntime", () => {
  it("已有全局存储但当前 origin 尚未初始化时也能初始化", async () => {
    storageBucket[STORAGE_KEY] = { globalEnabled: true, origins: {} };
    const runtime = createRuntime();

    await expect(initializeRuntime(runtime)).resolves.toBeUndefined();

    const stored = storageBucket[STORAGE_KEY] as BridgeStorageState;
    expect(stored.origins[origin]).toBeDefined();
  });
});

describe("applyCommand", () => {
  it("应用命令到本地镜像，并经后台写入共享存储", async () => {
    const runtime = createRuntime();
    await initializeRuntime(runtime);

    await applyCommand(runtime, createSendLog("openCamera"));

    const stored = storageBucket[STORAGE_KEY] as BridgeStorageState;
    const storedLogs = stored.origins[origin].profiles.pkg01.logs;
    expect(storedLogs[0]?.event).toBe("openCamera");
    expect(getActiveProfileState(runtime.state!).logs[0]?.event).toBe("openCamera");
  });

  it("一次持久化失败不会毒化后续命令（链恢复）", async () => {
    const runtime = createRuntime();
    await initializeRuntime(runtime);
    sendMessageMock.mockRejectedValueOnce(new Error("Quota exceeded"));

    await expect(applyCommand(runtime, createSendLog("first"))).rejects.toThrow("Quota exceeded");

    // 链已恢复：后续命令正常执行并写入存储。
    await applyCommand(runtime, createSendLog("second"));

    const stored = storageBucket[STORAGE_KEY] as BridgeStorageState;
    expect(stored.origins[origin].profiles.pkg01.logs.map((log) => log.event)).toEqual([
      "second",
    ]);
    // 镜像保留失败的命令直到下一次存储重载；不再出现未处理 rejection。
    expect(getActiveProfileState(runtime.state!).logs.map((log) => log.event)).toEqual([
      "second",
      "first",
    ]);
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

    await applyCommand(runtimeA, createSendLog("openCamera", { success: true }));

    const syncedSnapshot = getSnapshot(runtimeB);

    expect(syncedSnapshot.href).toBe(`${origin}/page-b`);
    expect(syncedSnapshot.logs[0]?.event).toBe("openCamera");
  });

  it("其他 origin 的存储变化不会触发快照重载", async () => {
    const runtime = createRuntime();
    await initializeRuntime(runtime);

    const unchangedSlice = createDefaultOriginState();
    const changes: Record<string, chrome.storage.StorageChange> = {
      [STORAGE_KEY]: {
        oldValue: { globalEnabled: true, origins: { [origin]: unchangedSlice } },
        newValue: {
          globalEnabled: true,
          origins: {
            [origin]: unchangedSlice,
            "https://other.example.com": createDefaultOriginState(),
          },
        },
      },
    };

    await expect(syncRuntimeFromStorageChange(runtime, changes, "local")).resolves.toBe(false);
  });
});

function cloneValue<T>(value: T): T {
  return value === undefined ? value : JSON.parse(JSON.stringify(value)) as T;
}

function installChromeMocks(): void {
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
    async remove(key: string) {
      delete storageBucket[key];
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

  // 模拟后台：APPLY_STATE_COMMAND 串行应用到存储桶。
  // 与真实 chrome.storage 一致，get 返回副本，应用不泄漏回存储桶。
  sendMessageMock = vi.fn(async (message: unknown) => {
    const request = message as { type: string; origin: string; command: StateCommand };
    if (request.type !== "APPLY_STATE_COMMAND") {
      return { ok: false, message: "unexpected message" };
    }
    const state = cloneValue(
      (storageBucket[STORAGE_KEY] ??
        { globalEnabled: true, origins: {} }) as BridgeStorageState,
    );
    const originState = cloneValue(state.origins[request.origin] ?? createDefaultOriginState());
    const working = { globalEnabled: state.globalEnabled, originState };
    applyCommandToRuntimeState(working, request.command);
    await local.set({
      [STORAGE_KEY]: {
        ...state,
        globalEnabled: working.globalEnabled,
        origins: { ...state.origins, [request.origin]: working.originState },
      },
    });
    return { ok: true };
  });

  (globalThis as typeof globalThis & { chrome: typeof chrome }).chrome = {
    storage: {
      local,
      onChanged,
    },
    runtime: {
      sendMessage: sendMessageMock,
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
