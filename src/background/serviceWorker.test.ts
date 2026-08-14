import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  ApplyStateCommandRequest,
  BackgroundToContentMessage,
  PanelCommandRequest,
  PanelCommandResponse,
} from "../shared/messageTypes";
import type { StateCommand } from "../shared/stateCommands";
import { STORAGE_KEY } from "../shared/constants";
import type { BridgeStorageState } from "../shared/bridgeTypes";

type RuntimeMessageListener = (
  message: unknown,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: PanelCommandResponse) => void,
) => boolean | void;

describe("serviceWorker command routing", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("会通过 tabs.sendMessage 将面板命令转发给当前 tab", async () => {
    const harness = await loadServiceWorkerHarness();

    const response = await harness.dispatch({
      type: "PANEL_COMMAND",
      tabId: 7,
      command: { type: "CLEAR_LOGS" },
    });

    expect(harness.sendMessage).toHaveBeenCalledWith(7, {
      type: "BACKGROUND_COMMAND",
      command: { type: "CLEAR_LOGS" },
    } satisfies BackgroundToContentMessage);
    expect(response).toEqual({ ok: true });
    expect(harness.executeScript).not.toHaveBeenCalled();
  });

  it("收件端缺失时会重注入脚本后重试命令", async () => {
    const harness = await loadServiceWorkerHarness();
    harness.sendMessage.mockRejectedValueOnce(
      new Error("Could not establish connection. Receiving end does not exist."),
    );

    const response = await harness.dispatch({
      type: "PANEL_COMMAND",
      tabId: 7,
      command: { type: "REQUEST_SNAPSHOT" },
    });

    expect(harness.executeScript).toHaveBeenNthCalledWith(1, {
      target: { tabId: 7 },
      files: ["injected/injectMain.js"],
      world: "MAIN",
    });
    expect(harness.executeScript).toHaveBeenNthCalledWith(2, {
      target: { tabId: 7 },
      files: ["content/contentScript.js"],
    });
    expect(harness.sendMessage).toHaveBeenCalledTimes(2);
    expect(response).toEqual({ ok: true });
  });

  it("注入失败时会把错误透传给面板", async () => {
    const harness = await loadServiceWorkerHarness();
    harness.sendMessage.mockRejectedValueOnce(
      new Error("Could not establish connection. Receiving end does not exist."),
    );
    harness.executeScript.mockRejectedValueOnce(new Error("Cannot access this page"));

    const response = await harness.dispatch({
      type: "PANEL_COMMAND",
      tabId: 7,
      command: { type: "MANUAL_EMIT", eventName: "toLogin", detail: { ok: true } },
    });

    expect(response).toEqual({
      ok: false,
      message: "Cannot access this page",
    });
  });

  it("APPLY_STATE_COMMAND 会把状态增量应用到存储并回执成功", async () => {
    const harness = await loadServiceWorkerHarness();

    const response = await harness.dispatchStateCommand({
      type: "APPLY_STATE_COMMAND",
      origin: "https://example.com",
      command: appendLogCommand("log-1", "openCamera"),
    });

    expect(response).toEqual({ ok: true });
    const stored = harness.storageBucket[STORAGE_KEY] as BridgeStorageState;
    expect(stored.origins["https://example.com"].profiles.pkg01.logs[0]?.event).toBe(
      "openCamera",
    );
  });

  it("状态命令按到达顺序串行应用，不会互相覆盖", async () => {
    const harness = await loadServiceWorkerHarness();

    await Promise.all([
      harness.dispatchStateCommand({
        type: "APPLY_STATE_COMMAND",
        origin: "https://example.com",
        command: appendLogCommand("log-1", "first"),
      }),
      harness.dispatchStateCommand({
        type: "APPLY_STATE_COMMAND",
        origin: "https://example.com",
        command: appendLogCommand("log-2", "second"),
      }),
    ]);

    const stored = harness.storageBucket[STORAGE_KEY] as BridgeStorageState;
    expect(stored.origins["https://example.com"].profiles.pkg01.logs.map((log) => log.id)).toEqual([
      "log-2",
      "log-1",
    ]);
  });

  it("状态写入失败时回执失败，且队列继续可用", async () => {
    const harness = await loadServiceWorkerHarness();
    harness.storageSet.mockRejectedValueOnce(new Error("Quota exceeded"));

    const failed = await harness.dispatchStateCommand({
      type: "APPLY_STATE_COMMAND",
      origin: "https://example.com",
      command: appendLogCommand("log-1", "first"),
    });

    expect(failed).toEqual({ ok: false, message: "Quota exceeded" });

    const recovered = await harness.dispatchStateCommand({
      type: "APPLY_STATE_COMMAND",
      origin: "https://example.com",
      command: appendLogCommand("log-2", "second"),
    });

    expect(recovered).toEqual({ ok: true });
    const stored = harness.storageBucket[STORAGE_KEY] as BridgeStorageState;
    expect(stored.origins["https://example.com"].profiles.pkg01.logs.map((log) => log.id)).toEqual([
      "log-2",
    ]);
  });
});

function appendLogCommand(id: string, event: string): StateCommand {
  return {
    type: "APPEND_LOG",
    log: { id, timestamp: 1, type: "SEND", event, payload: {} },
  };
}

async function loadServiceWorkerHarness(): Promise<{
  dispatch: (message: PanelCommandRequest) => Promise<PanelCommandResponse>;
  dispatchStateCommand: (message: ApplyStateCommandRequest) => Promise<PanelCommandResponse>;
  executeScript: ReturnType<typeof vi.fn>;
  sendMessage: ReturnType<typeof vi.fn>;
  storageSet: ReturnType<typeof vi.fn>;
  storageBucket: Record<string, unknown>;
}> {
  let runtimeMessageListener: RuntimeMessageListener | null = null;
  const sendMessage = vi.fn(() => Promise.resolve({ ok: true }));
  const executeScript = vi.fn(() => Promise.resolve([]));
  const storageBucket: Record<string, unknown> = {};
  const storageSet = vi.fn(async (items: Record<string, unknown>) => {
    for (const [key, value] of Object.entries(items)) {
      storageBucket[key] = JSON.parse(JSON.stringify(value)) as unknown;
    }
  });

  (globalThis as typeof globalThis & { chrome: typeof chrome }).chrome = {
    runtime: {
      onMessage: {
        addListener(listener: RuntimeMessageListener) {
          runtimeMessageListener = listener;
        },
      },
    },
    scripting: {
      executeScript,
    },
    tabs: {
      sendMessage,
    },
    storage: {
      local: {
        get: vi.fn(async (key: string) => ({
          [key]: JSON.parse(JSON.stringify(storageBucket[key] ?? null)) as unknown,
        })),
        set: storageSet,
        remove: vi.fn(async () => undefined),
      },
    },
  } as unknown as typeof chrome;

  await import("./serviceWorker");

  if (!runtimeMessageListener) {
    throw new Error("serviceWorker did not register runtime.onMessage listener");
  }

  const dispatchRaw = (
    message: unknown,
  ): Promise<PanelCommandResponse> =>
    new Promise((resolve) => {
      runtimeMessageListener?.(message, {} as chrome.runtime.MessageSender, resolve);
    });

  return {
    dispatch(message) {
      return dispatchRaw(message);
    },
    dispatchStateCommand(message) {
      return dispatchRaw(message);
    },
    executeScript,
    sendMessage,
    storageSet,
    storageBucket,
  };
}
