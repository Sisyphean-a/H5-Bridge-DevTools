import type { BridgeLogItem, BridgeLogType, BridgePanelSnapshot } from "../shared/bridgeTypes";
import { cloneJson } from "../shared/json";
import type { PanelCommand } from "../shared/messageTypes";
import { createBlankSender, getPresetSenders } from "../shared/presets";
import { duplicateSender, mergeImportedSenders } from "../shared/rules";
import type { OriginBridgeSettings } from "../shared/ruleTypes";
import type { BridgeResponseOption, BridgeSender } from "../shared/senderTypes";

const previewSettings: OriginBridgeSettings = {
  autoMock: true,
  preserveLogs: true,
  maxLogCount: 200,
  overrideExistingAndroidBridge: true,
};

export function createPreviewSnapshot(): BridgePanelSnapshot {
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

export function applyPreviewCommand(
  snapshot: BridgePanelSnapshot,
  command: PanelCommand,
  dispatchEvent?: (eventName: string, detail: unknown) => void,
): BridgePanelSnapshot {
  switch (command.type) {
    case "REQUEST_SNAPSHOT":
      return snapshot;
    case "UPSERT_SENDER":
      return { ...snapshot, senders: upsertSender(snapshot.senders, command.sender) };
    case "DELETE_SENDER":
      return {
        ...snapshot,
        senders: snapshot.senders.filter((sender) => sender.id !== command.senderId),
      };
    case "DUPLICATE_SENDER":
      return { ...snapshot, senders: appendDuplicate(snapshot.senders, command.senderId) };
    case "TOGGLE_SENDER":
      return {
        ...snapshot,
        senders: snapshot.senders.map((sender) =>
          sender.id === command.senderId ? { ...sender, enabled: command.enabled } : sender,
        ),
      };
    case "SET_ACTIVE_RESPONSE":
      return {
        ...snapshot,
        senders: snapshot.senders.map((sender) =>
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
        ),
      };
    case "UPSERT_RESPONSE":
      return {
        ...snapshot,
        senders: snapshot.senders.map((sender) =>
          sender.id === command.senderId
            ? {
                ...sender,
                responses: upsertResponse(sender.responses, command.response),
                activeResponseId:
                  sender.activeResponseId ?? sender.responses[0]?.id ?? command.response.id,
              }
            : sender,
        ),
      };
    case "DELETE_RESPONSE":
      return {
        ...snapshot,
        senders: snapshot.senders.map((sender) => {
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
        }),
      };
    case "TRIGGER_RESPONSE":
      return triggerPreviewResponse(snapshot, command.senderId, command.responseId, dispatchEvent);
    case "IMPORT_SENDERS":
      return {
        ...snapshot,
        senders: mergeImportedSenders(snapshot.senders, command.senders, command.strategy),
      };
    case "CLEAR_LOGS":
      return { ...snapshot, logs: [] };
    case "SET_GLOBAL_ENABLED":
      return { ...snapshot, globalEnabled: command.enabled };
    case "UPDATE_SETTINGS":
      return { ...snapshot, settings: { ...snapshot.settings, ...command.settings } };
    case "MANUAL_EMIT":
      return appendEmitLog(snapshot, command.eventName, command.detail);
    case "REPLAY_LOG_RESPONSE": {
      const log = snapshot.logs.find((item) => item.id === command.logId);
      return log?.event ? appendEmitLog(snapshot, log.event, log.response ?? {}) : snapshot;
    }
  }
}

function triggerPreviewResponse(
  snapshot: BridgePanelSnapshot,
  senderId: string,
  responseId: string,
  dispatchEvent?: (eventName: string, detail: unknown) => void,
): BridgePanelSnapshot {
  const sender = snapshot.senders.find((item) => item.id === senderId);
  const response = sender?.responses.find((item) => item.id === responseId);
  if (!response) {
    return snapshot;
  }

  dispatchEvent?.(response.eventName, response.detail);
  return appendEmitLog(snapshot, response.eventName, response.detail);
}

function appendEmitLog(
  snapshot: BridgePanelSnapshot,
  eventName: string,
  detail: unknown,
): BridgePanelSnapshot {
  return {
    ...snapshot,
    logs: [
      createLogItem("EMIT", eventName, { response: cloneJson(detail) }),
      ...snapshot.logs,
    ].slice(0, snapshot.settings.maxLogCount),
  };
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
