import type { BridgeLogItem, BridgeLogType, BridgePanelSnapshot } from "../shared/bridgeTypes";
import { cloneJson } from "../shared/json";
import type {
  BackgroundToPanelMessage,
  PanelCommand,
  PanelPortMessage,
} from "../shared/messageTypes";
import { createBlankSender, getPresetSenders } from "../shared/presets";
import { duplicateSender, mergeImportedSenders } from "../shared/rules";
import type { OriginBridgeSettings } from "../shared/ruleTypes";
import type { BridgeResponseOption, BridgeSender } from "../shared/senderTypes";

type PortListener = (message: BackgroundToPanelMessage) => void;
type DisconnectListener = () => void;

const previewSettings: OriginBridgeSettings = {
  autoMock: true,
  preserveLogs: true,
  maxLogCount: 200,
  overrideExistingAndroidBridge: true,
};

let previewSnapshot = createPreviewSnapshot();

export function installPreviewChrome(): void {
  const runtime = {
    connect() {
      return createPort();
    },
  };

  const devtools = {
    inspectedWindow: { tabId: 1 },
  };

  (globalThis as typeof globalThis & { chrome: typeof chrome }).chrome = {
    runtime,
    devtools,
  } as unknown as typeof chrome;
}

function createPort(): chrome.runtime.Port {
  const listeners = new Set<PortListener>();
  const disconnectListeners = new Set<DisconnectListener>();

  return {
    name: "preview-port",
    onMessage: {
      addListener(listener) {
        listeners.add(listener as PortListener);
      },
      removeListener(listener) {
        listeners.delete(listener as PortListener);
      },
      hasListener(listener) {
        return listeners.has(listener as PortListener);
      },
      hasListeners() {
        return listeners.size > 0;
      },
    },
    onDisconnect: {
      addListener(listener) {
        disconnectListeners.add(listener as DisconnectListener);
      },
      removeListener(listener) {
        disconnectListeners.delete(listener as DisconnectListener);
      },
      hasListener(listener) {
        return disconnectListeners.has(listener as DisconnectListener);
      },
      hasListeners() {
        return disconnectListeners.size > 0;
      },
    },
    postMessage(message: PanelPortMessage) {
      handlePortMessage(message, listeners);
    },
    disconnect() {
      disconnectListeners.forEach((listener) => listener());
    },
    sender: undefined,
  } as chrome.runtime.Port;
}

function handlePortMessage(
  message: PanelPortMessage,
  listeners: Set<PortListener>,
): void {
  if (message.type === "PANEL_INIT") {
    emitSnapshot(listeners);
    return;
  }

  applyCommand(message.command);
  emitSnapshot(listeners);
}

function emitSnapshot(listeners: Set<PortListener>): void {
  const payload: BackgroundToPanelMessage = {
    type: "BACKGROUND_EVENT",
    event: {
      type: "SNAPSHOT",
      snapshot: cloneJson(previewSnapshot),
    },
  };
  listeners.forEach((listener) => listener(payload));
}

function applyCommand(command: PanelCommand): void {
  switch (command.type) {
    case "REQUEST_SNAPSHOT":
      return;
    case "UPSERT_SENDER":
      previewSnapshot.senders = upsertSender(previewSnapshot.senders, command.sender);
      return;
    case "DELETE_SENDER":
      previewSnapshot.senders = previewSnapshot.senders.filter(
        (sender) => sender.id !== command.senderId,
      );
      return;
    case "DUPLICATE_SENDER":
      previewSnapshot.senders = appendDuplicate(previewSnapshot.senders, command.senderId);
      return;
    case "TOGGLE_SENDER":
      previewSnapshot.senders = previewSnapshot.senders.map((sender) =>
        sender.id === command.senderId ? { ...sender, enabled: command.enabled } : sender,
      );
      return;
    case "SET_ACTIVE_RESPONSE":
      previewSnapshot.senders = previewSnapshot.senders.map((sender) =>
        sender.id === command.senderId
          ? {
              ...sender,
              activeResponseId:
                command.responseId === null ||
                sender.responses.some((response) => response.id === command.responseId)
                  ? command.responseId
                  : sender.activeResponseId,
            }
          : sender,
      );
      return;
    case "UPSERT_RESPONSE":
      previewSnapshot.senders = previewSnapshot.senders.map((sender) =>
        sender.id === command.senderId
          ? {
              ...sender,
              responses: upsertResponse(sender.responses, command.response),
              activeResponseId:
                sender.activeResponseId ?? sender.responses[0]?.id ?? command.response.id,
            }
          : sender,
      );
      return;
    case "DELETE_RESPONSE":
      previewSnapshot.senders = previewSnapshot.senders.map((sender) => {
        if (sender.id !== command.senderId) {
          return sender;
        }
        const responses = sender.responses.filter((response) => response.id !== command.responseId);
        return {
          ...sender,
          responses,
          activeResponseId:
            sender.activeResponseId === command.responseId
              ? (responses[0]?.id ?? null)
              : sender.activeResponseId,
        };
      });
      return;
    case "TRIGGER_RESPONSE":
      triggerResponse(command.senderId, command.responseId);
      return;
    case "IMPORT_SENDERS":
      previewSnapshot.senders = mergeImportedSenders(
        previewSnapshot.senders,
        command.senders,
        command.strategy,
      );
      return;
    case "CLEAR_LOGS":
      previewSnapshot.logs = [];
      return;
    case "SET_GLOBAL_ENABLED":
      previewSnapshot.globalEnabled = command.enabled;
      return;
    case "UPDATE_SETTINGS":
      previewSnapshot.settings = { ...previewSnapshot.settings, ...command.settings };
      return;
    case "MANUAL_EMIT":
      appendEmitLog(command.eventName, command.detail);
      return;
    case "REPLAY_LOG_RESPONSE": {
      const log = previewSnapshot.logs.find((item) => item.id === command.logId);
      if (log?.event) {
        appendEmitLog(log.event, log.response ?? {});
      }
      return;
    }
  }
}

function triggerResponse(senderId: string, responseId: string): void {
  const sender = previewSnapshot.senders.find((item) => item.id === senderId);
  const response = sender?.responses.find((item) => item.id === responseId);
  if (!response) {
    return;
  }

  window.dispatchEvent(new CustomEvent(response.eventName, { detail: response.detail }));
  appendEmitLog(response.eventName, response.detail);
}

function appendEmitLog(eventName: string, detail: unknown): void {
  previewSnapshot.logs = [
    createLogItem("EMIT", eventName, { response: cloneJson(detail) }),
    ...previewSnapshot.logs,
  ].slice(0, previewSnapshot.settings.maxLogCount);
}

function upsertSender(senders: BridgeSender[], sender: BridgeSender): BridgeSender[] {
  const index = senders.findIndex((item) => item.id === sender.id);
  return index >= 0
    ? senders.map((item, itemIndex) => (itemIndex === index ? cloneJson(sender) : item))
    : [...senders, cloneJson(sender)];
}

function appendDuplicate(senders: BridgeSender[], senderId: string): BridgeSender[] {
  const sender = senders.find((item) => item.id === senderId);
  return sender ? [...senders, duplicateSender(sender)] : senders;
}

function upsertResponse(
  responses: BridgeResponseOption[],
  response: BridgeResponseOption,
): BridgeResponseOption[] {
  const index = responses.findIndex((item) => item.id === response.id);
  return index >= 0
    ? responses.map((item, itemIndex) => (itemIndex === index ? cloneJson(response) : item))
    : [...responses, cloneJson(response)];
}

function createPreviewSnapshot(): BridgePanelSnapshot {
  const senders = getPresetSenders().slice(0, 3);
  const extraSender = createBlankSender();
  extraSender.name = "获取用户信息";
  extraSender.matchEvent = "getUserInfo";
  extraSender.responses = [];
  extraSender.activeResponseId = null;

  return {
    origin: "https://preview.local",
    href: "https://preview.local/devtools",
    globalEnabled: true,
    senders: [...senders, extraSender],
    logs: createPreviewLogs(),
    settings: { ...previewSettings },
  };
}

function createPreviewLogs(): BridgeLogItem[] {
  return [
    createLogItem("SEND", "toLogin", {
      timestamp: Date.now() - 32_000,
      payload: { event: "toLogin", detail: { mobile: "138****0000" } },
    }),
    createLogItem("MOCK", "toLogin", {
      timestamp: Date.now() - 31_500,
      response: { success: true, token: "mock-token-001" },
    }),
    createLogItem("WARN", "getUserInfo", {
      timestamp: Date.now() - 15_000,
      message: "Sender \"获取用户信息\" has no active response.",
    }),
  ];
}

function createLogItem(
  type: BridgeLogType,
  event: string,
  extra: Partial<BridgeLogItem>,
): BridgeLogItem {
  return {
    id: extra.id ?? `log-${type.toLowerCase()}-${Date.now()}-${Math.random()}`,
    type,
    event,
    timestamp: extra.timestamp ?? Date.now(),
    payload: extra.payload,
    response: extra.response,
    message: extra.message,
    ruleId: extra.ruleId,
  };
}
