import type { BridgePanelSnapshot } from "../shared/bridgeTypes";
import type {
  BackgroundToContentMessage,
  BackgroundToPanelMessage,
  ContentPortMessage,
  PanelPortMessage,
} from "../shared/messageTypes";

const panelPorts = new Map<number, chrome.runtime.Port>();
const contentPorts = new Map<number, chrome.runtime.Port>();
const snapshots = new Map<number, BridgePanelSnapshot>();

chrome.runtime.onConnect.addListener((port) => {
  if (port.name === "h5-bridge-panel") {
    attachPanelPort(port);
    return;
  }

  if (port.name === "h5-bridge-content") {
    attachContentPort(port);
  }
});

function attachPanelPort(port: chrome.runtime.Port): void {
  let panelTabId = -1;

  port.onMessage.addListener((message: PanelPortMessage) => {
    if (message.type === "PANEL_INIT") {
      panelTabId = message.tabId;
      panelPorts.set(panelTabId, port);
      sendCachedSnapshot(panelTabId);
      return;
    }

    if (panelTabId < 0) {
      return;
    }

    const contentPort = contentPorts.get(panelTabId);
    if (!contentPort) {
      postPanelNotice(port, "error", "当前页面未连接 content script。");
      return;
    }

    const payload: BackgroundToContentMessage = {
      type: "BACKGROUND_COMMAND",
      command: message.command,
    };
    contentPort.postMessage(payload);
  });

  port.onDisconnect.addListener(() => {
    if (panelTabId >= 0 && panelPorts.get(panelTabId) === port) {
      panelPorts.delete(panelTabId);
    }
  });
}

function attachContentPort(port: chrome.runtime.Port): void {
  const tabId = port.sender?.tab?.id;
  if (tabId == null) {
    port.disconnect();
    return;
  }

  contentPorts.set(tabId, port);

  port.onMessage.addListener((message: ContentPortMessage) => {
    if (message.type === "CONTENT_READY") {
      snapshots.set(tabId, message.snapshot);
      postPanelEvent(tabId, { type: "SNAPSHOT", snapshot: message.snapshot });
      return;
    }

    if (message.event.type === "SNAPSHOT") {
      snapshots.set(tabId, message.event.snapshot);
    }
    postPanelEvent(tabId, message.event);
  });

  port.onDisconnect.addListener(() => {
    if (contentPorts.get(tabId) === port) {
      contentPorts.delete(tabId);
    }
  });
}

function sendCachedSnapshot(tabId: number): void {
  const snapshot = snapshots.get(tabId);
  if (!snapshot) {
    return;
  }

  postPanelEvent(tabId, { type: "SNAPSHOT", snapshot });
}

function postPanelEvent(
  tabId: number,
  event: BackgroundToPanelMessage["event"],
): void {
  const panelPort = panelPorts.get(tabId);
  if (!panelPort) {
    return;
  }

  const payload: BackgroundToPanelMessage = {
    type: "BACKGROUND_EVENT",
    event,
  };
  panelPort.postMessage(payload);
}

function postPanelNotice(
  port: chrome.runtime.Port,
  level: "info" | "error",
  message: string,
): void {
  const payload: BackgroundToPanelMessage = {
    type: "BACKGROUND_EVENT",
    event: {
      type: "NOTICE",
      level,
      message,
    },
  };
  port.postMessage(payload);
}
