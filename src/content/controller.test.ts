import { beforeEach, describe, expect, it, vi } from "vitest";

type StorageListener = (
  changes: Record<string, chrome.storage.StorageChange>,
  areaName: string,
) => void | Promise<void>;
type MessageListener = (event: MessageEvent) => void;
type PortEntry = ReturnType<typeof createMockPort>;

let connectPortEntries: PortEntry[];
let connectMock: ReturnType<typeof vi.fn>;
let storageListeners: Set<StorageListener>;
let windowMessageListeners: Set<MessageListener>;
let storageBucket: Record<string, unknown>;

describe("content controller runtime lifecycle", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.resetModules();
    connectPortEntries = [];
    storageListeners = new Set<StorageListener>();
    windowMessageListeners = new Set<MessageListener>();
    storageBucket = {};
    installWindowMock();
    installChromeMock();
  });

  it("background 端口断开后会自动重连并重新发送 CONTENT_READY", async () => {
    const controller = await import("./controller");

    controller.bootstrapContentScript();
    await waitForMessageCount(0, 1);

    expect(connectMock).toHaveBeenCalledTimes(1);
    expect(connectPortEntries[0]?.messages).toEqual([
      expect.objectContaining({
        type: "CONTENT_READY",
        snapshot: expect.objectContaining({ href: "https://example.com/page-a" }),
      }),
    ]);

    connectPortEntries[0]?.disconnect();
    await vi.advanceTimersByTimeAsync(60);
    await waitForMessageCount(1, 1);

    expect(connectMock).toHaveBeenCalledTimes(2);
    expect(connectPortEntries[1]?.messages).toEqual([
      expect.objectContaining({
        type: "CONTENT_READY",
        snapshot: expect.objectContaining({ href: "https://example.com/page-a" }),
      }),
    ]);
  });
});

function createMockPort() {
  const messageListeners = new Set<(message: unknown) => void>();
  const disconnectListeners = new Set<(port: chrome.runtime.Port) => void>();
  const messages: unknown[] = [];
  const port = {
    name: "h5-bridge-content",
    onMessage: {
      addListener(listener: (message: unknown) => void) {
        messageListeners.add(listener);
      },
      removeListener(listener: (message: unknown) => void) {
        messageListeners.delete(listener);
      },
      hasListener(listener: (message: unknown) => void) {
        return messageListeners.has(listener);
      },
      hasListeners() {
        return messageListeners.size > 0;
      },
    },
    onDisconnect: {
      addListener(listener: (port: chrome.runtime.Port) => void) {
        disconnectListeners.add(listener);
      },
      removeListener(listener: (port: chrome.runtime.Port) => void) {
        disconnectListeners.delete(listener);
      },
      hasListener(listener: (port: chrome.runtime.Port) => void) {
        return disconnectListeners.has(listener);
      },
      hasListeners() {
        return disconnectListeners.size > 0;
      },
    },
    postMessage(message: unknown) {
      messages.push(message);
    },
  } as chrome.runtime.Port;

  return {
    messages,
    port,
    disconnect() {
      disconnectListeners.forEach((listener) => listener(port));
    },
  };
}

async function flushAsyncWork(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

async function waitForMessageCount(index: number, count: number): Promise<void> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    await flushAsyncWork();
    if ((connectPortEntries[index]?.messages.length ?? 0) >= count) {
      return;
    }
  }
}

function installChromeMock(): void {
  connectMock = vi.fn(() => {
    const entry = createMockPort();
    connectPortEntries.push(entry);
    return entry.port;
  });

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
    runtime: {
      id: "extension-id",
      connect: connectMock,
    },
    storage: {
      local,
      onChanged,
    },
  } as unknown as typeof chrome;
}

function installWindowMock(): void {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      addEventListener(type: string, listener: MessageListener) {
        if (type === "message") {
          windowMessageListeners.add(listener);
        }
      },
      clearTimeout,
      location: {
        href: "https://example.com/page-a",
        origin: "https://example.com",
      },
      postMessage: vi.fn(),
      removeEventListener(type: string, listener: MessageListener) {
        if (type === "message") {
          windowMessageListeners.delete(listener);
        }
      },
      setTimeout,
    },
  });
}

function cloneValue<T>(value: T): T {
  return value === undefined ? value : JSON.parse(JSON.stringify(value)) as T;
}
