import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSnapshot } from "../test/factories";
import type {
  BackgroundToContentMessage,
  BackgroundToPanelMessage,
  ContentPortMessage,
  PanelPortMessage,
} from "../shared/messageTypes";

type Listener<T> = (payload: T) => void;

describe("serviceWorker bridge routing", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("panel 初始化后会收到同 tab 已缓存的最新快照", async () => {
    const harness = await loadServiceWorkerHarness();
    const snapshot = createSnapshot({ href: "https://example.com/page-a" });
    const contentPort = createMockPort<ContentPortMessage>("h5-bridge-content", 7);
    const panelPort = createMockPort<PanelPortMessage>("h5-bridge-panel");

    harness.connect(contentPort.port);
    contentPort.emitMessage({ type: "CONTENT_READY", snapshot });
    harness.connect(panelPort.port);
    panelPort.emitMessage({ type: "PANEL_INIT", tabId: 7 });

    expect(panelPort.messages).toEqual([
      {
        type: "BACKGROUND_EVENT",
        event: { type: "SNAPSHOT", snapshot },
      },
    ]);
  });

  it("content script 推送 SNAPSHOT 时会实时转发给已打开的 panel", async () => {
    const harness = await loadServiceWorkerHarness();
    const contentPort = createMockPort<ContentPortMessage>("h5-bridge-content", 7);
    const panelPort = createMockPort<PanelPortMessage>("h5-bridge-panel");
    const snapshot = createSnapshot({ href: "https://example.com/page-b" });

    harness.connect(contentPort.port);
    harness.connect(panelPort.port);
    panelPort.emitMessage({ type: "PANEL_INIT", tabId: 7 });
    panelPort.messages.length = 0;
    contentPort.emitMessage({
      type: "CONTENT_EVENT",
      event: { type: "SNAPSHOT", snapshot },
    });

    expect(panelPort.messages).toEqual([
      {
        type: "BACKGROUND_EVENT",
        event: { type: "SNAPSHOT", snapshot },
      },
    ]);
  });

  it("请求快照时若 content script 尚未重连则回放缓存快照而不是报错", async () => {
    const harness = await loadServiceWorkerHarness();
    const snapshot = createSnapshot({ href: "https://example.com/page-c" });
    const contentPort = createMockPort<ContentPortMessage>("h5-bridge-content", 7);
    const panelPort = createMockPort<PanelPortMessage>("h5-bridge-panel");

    harness.connect(contentPort.port);
    contentPort.emitMessage({ type: "CONTENT_READY", snapshot });
    harness.connect(panelPort.port);
    panelPort.emitMessage({ type: "PANEL_INIT", tabId: 7 });
    panelPort.messages.length = 0;
    contentPort.port.disconnect();
    panelPort.emitMessage({
      type: "PANEL_COMMAND",
      tabId: 7,
      command: { type: "REQUEST_SNAPSHOT" },
    });

    expect(panelPort.messages).toEqual([
      {
        type: "BACKGROUND_EVENT",
        event: { type: "SNAPSHOT", snapshot },
      },
    ]);
  });
});

async function loadServiceWorkerHarness(): Promise<{
  connect: (port: chrome.runtime.Port) => void;
}> {
  let connectListener: Listener<chrome.runtime.Port> | null = null;

  (globalThis as typeof globalThis & { chrome: typeof chrome }).chrome = {
    runtime: {
      onConnect: {
        addListener(listener: Listener<chrome.runtime.Port>) {
          connectListener = listener;
        },
      },
    },
  } as unknown as typeof chrome;

  await import("./serviceWorker");

  if (!connectListener) {
    throw new Error("serviceWorker did not register onConnect listener");
  }

  return {
    connect(port) {
      connectListener?.(port);
    },
  };
}

function createMockPort<TMessage extends ContentPortMessage | PanelPortMessage>(
  name: string,
  tabId?: number,
): {
  port: chrome.runtime.Port;
  messages: Array<BackgroundToPanelMessage | BackgroundToContentMessage>;
  emitMessage: (message: TMessage) => void;
} {
  const messageListeners = new Set<Listener<TMessage>>();
  const disconnectListeners = new Set<Listener<chrome.runtime.Port>>();
  const messages: Array<BackgroundToPanelMessage | BackgroundToContentMessage> = [];
  const port = {
    name,
    sender: tabId == null ? undefined : ({ tab: { id: tabId } } as chrome.runtime.MessageSender),
    onMessage: {
      addListener(listener: Listener<TMessage>) {
        messageListeners.add(listener);
      },
      removeListener(listener: Listener<TMessage>) {
        messageListeners.delete(listener);
      },
      hasListener(listener: Listener<TMessage>) {
        return messageListeners.has(listener);
      },
      hasListeners() {
        return messageListeners.size > 0;
      },
    },
    onDisconnect: {
      addListener(listener: Listener<chrome.runtime.Port>) {
        disconnectListeners.add(listener);
      },
      removeListener(listener: Listener<chrome.runtime.Port>) {
        disconnectListeners.delete(listener);
      },
      hasListener(listener: Listener<chrome.runtime.Port>) {
        return disconnectListeners.has(listener);
      },
      hasListeners() {
        return disconnectListeners.size > 0;
      },
    },
    postMessage(message: BackgroundToPanelMessage | BackgroundToContentMessage) {
      messages.push(message);
    },
    disconnect() {
      disconnectListeners.forEach((listener) => listener(port as chrome.runtime.Port));
    },
  } as chrome.runtime.Port;

  return {
    port,
    messages,
    emitMessage(message) {
      messageListeners.forEach((listener) => listener(message));
    },
  };
}
