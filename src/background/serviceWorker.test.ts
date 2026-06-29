import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  BackgroundToContentMessage,
  PanelCommandRequest,
  PanelCommandResponse,
} from "../shared/messageTypes";

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
});

async function loadServiceWorkerHarness(): Promise<{
  dispatch: (message: PanelCommandRequest) => Promise<PanelCommandResponse>;
  executeScript: ReturnType<typeof vi.fn>;
  sendMessage: ReturnType<typeof vi.fn>;
}> {
  let runtimeMessageListener: RuntimeMessageListener | null = null;
  const sendMessage = vi.fn(() => Promise.resolve({ ok: true }));
  const executeScript = vi.fn(() => Promise.resolve([]));

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
  } as unknown as typeof chrome;

  await import("./serviceWorker");

  if (!runtimeMessageListener) {
    throw new Error("serviceWorker did not register runtime.onMessage listener");
  }

  return {
    dispatch(message) {
      return new Promise((resolve) => {
        runtimeMessageListener?.(message, {} as chrome.runtime.MessageSender, resolve);
      });
    },
    executeScript,
    sendMessage,
  };
}
