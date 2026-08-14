import { SOURCE_PAGE } from "../shared/constants";
import type {
  PageBridgeCallMessage,
  PanelCommand,
  PanelCommandResponse,
} from "../shared/messageTypes";
import { sanitizeForStorage } from "../shared/json";
import type { RulePackage } from "../shared/rulePackage";
import type { ImportStrategy } from "../shared/ruleTypes";
import {
  duplicateSender,
  findSenderByEvent,
  getActiveResponse,
  MAX_RESPONSE_DELAY_MS,
  mergeImportedSenders,
} from "../shared/rules";
import type { BridgeLogItem } from "../shared/bridgeTypes";
import type { BridgeSender } from "../shared/senderTypes";
import type { HitCountDelta } from "../shared/stateCommands";
import { getOriginProfile, importRulePackageIntoOriginState } from "../shared/storage";
import {
  applyCommand,
  createLogEntry,
  dispatchToPage,
  getActiveProfileState,
  initializeRuntime,
  readEventName,
  syncRuntimeFromStorageChange,
  syncSettingsToPage,
  type ContentRuntime,
} from "./runtime";

const runtime = createRuntime();

export function bootstrapContentScript(): void {
  runtime.ready = initializeRuntime(runtime);
  chrome.runtime.onMessage.addListener(handleRuntimeMessage);
  chrome.storage.onChanged.addListener(handleStorageChange);
  window.addEventListener("message", handleWindowMessage);
}

function createRuntime(): ContentRuntime {
  return {
    state: null,
    ready: Promise.resolve(),
    chain: Promise.resolve(),
  };
}

function handleRuntimeMessage(
  message: unknown,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response: PanelCommandResponse) => void,
): boolean | void {
  if (!isBackgroundCommandMessage(message)) {
    return;
  }

  void runtime.ready
    .then(async () => {
      await handlePanelCommand(message.command);
      sendResponse({ ok: true });
    })
    .catch((error: unknown) => {
      sendResponse({ ok: false, message: toErrorMessage(error) });
    });
  return true;
}

function handleStorageChange(
  changes: Record<string, chrome.storage.StorageChange>,
  areaName: string,
): void {
  void runtime.ready
    .then(() => syncRuntimeFromStorageChange(runtime, changes, areaName))
    .catch((error: unknown) => {
      console.warn("[H5Bridge] 刷新存储快照失败。", error);
    });
}

function handleWindowMessage(event: MessageEvent<PageBridgeCallMessage>): void {
  void runtime.ready
    .then(() => handlePageMessage(event))
    .catch((error: unknown) => {
      console.warn("[H5Bridge] 处理页面桥接调用失败。", error);
    });
}

async function handlePageMessage(
  event: MessageEvent<PageBridgeCallMessage>,
): Promise<void> {
  if (event.source !== window) {
    return;
  }
  if (!event.data || event.data.source !== SOURCE_PAGE) {
    return;
  }
  if (event.data.type !== "BRIDGE_CALL") {
    return;
  }

  await recordBridgeCall(event.data);
}

async function recordBridgeCall(message: PageBridgeCallMessage): Promise<void> {
  const runtimeState = runtime.state;
  if (!runtimeState) {
    return;
  }

  const activeProfile = getOriginProfile(
    runtimeState.originState,
    runtimeState.originState.activeProfileId,
  );
  const safeParsed = sanitizeForStorage(message.payload.parsedMessage);
  const eventName = readEventName(safeParsed, activeProfile.requestEventField);
  const payload = safeParsed ?? sanitizeForStorage(message.payload.rawMessage);

  const sendLog = createLogEntry({ type: "SEND", event: eventName, payload });
  let extraLog: BridgeLogItem | null = null;
  let hit: HitCountDelta | null = null;

  if (!eventName) {
    extraLog = createLogEntry({
      type: "ERROR",
      payload,
      message: `Bridge message has no ${activeProfile.requestEventField ?? "event"} field.`,
    });
  } else if (runtimeState.globalEnabled && getActiveProfileState(runtimeState).settings.autoMock) {
    const sender = findSenderByEvent(getActiveProfileState(runtimeState).senders, eventName);
    if (!sender) {
      extraLog = createLogEntry({
        type: "WARN",
        event: eventName,
        payload,
        message: `No sender matched for event "${eventName}".`,
      });
    } else {
      const activeResponse = getActiveResponse(sender);
      if (!activeResponse) {
        extraLog = createLogEntry({
          type: "WARN",
          event: eventName,
          payload,
          message: `Sender "${sender.name}" has no active response.`,
        });
      } else {
        hit = { senderId: sender.id, responseId: activeResponse.id, now: Date.now() };
        const senderId = sender.id;
        const responseId = activeResponse.id;
        const delayMs = Math.min(activeResponse.delayMs, MAX_RESPONSE_DELAY_MS);
        window.setTimeout(() => {
          void dispatchActiveResponse(senderId, responseId).catch((error: unknown) => {
            console.warn("[H5Bridge] 派发自动回包失败。", error);
          });
        }, delayMs);
      }
    }
  }

  await applyCommand(runtime, {
    type: "RECORD_BRIDGE_CALL",
    log: sendLog,
    extraLog,
    hit,
  });
}

async function handlePanelCommand(command: PanelCommand): Promise<void> {
  switch (command.type) {
    case "REQUEST_SNAPSHOT":
      return;
    case "SET_ACTIVE_PROFILE":
      await applyCommand(runtime, { type: "SET_ACTIVE_PROFILE", profileId: command.profileId });
      syncSettingsToPage(runtime);
      return;
    case "UPSERT_SENDER":
      await applyCommand(runtime, { type: "UPSERT_SENDER", sender: command.sender, now: Date.now() });
      return;
    case "DELETE_SENDER":
      await applyCommand(runtime, { type: "DELETE_SENDER", senderId: command.senderId });
      return;
    case "DUPLICATE_SENDER":
      await duplicateSenderById(command.senderId);
      return;
    case "SET_ACTIVE_RESPONSE":
      await applyCommand(runtime, {
        type: "SET_ACTIVE_RESPONSE",
        senderId: command.senderId,
        responseId: command.responseId,
        now: Date.now(),
      });
      return;
    case "UPSERT_RESPONSE":
      await applyCommand(runtime, {
        type: "UPSERT_RESPONSE",
        senderId: command.senderId,
        response: command.response,
        now: Date.now(),
      });
      return;
    case "DELETE_RESPONSE":
      await applyCommand(runtime, {
        type: "DELETE_RESPONSE",
        senderId: command.senderId,
        responseId: command.responseId,
      });
      return;
    case "TRIGGER_RESPONSE":
      await triggerResponse(command.senderId, command.responseId);
      return;
    case "IMPORT_SENDERS":
      await importSenders(command.senders, command.strategy);
      return;
    case "IMPORT_RULE_PACKAGE":
      await importRulePackage(command.rulePackage, command.strategy);
      return;
    case "CLEAR_LOGS":
      await applyCommand(runtime, { type: "CLEAR_LOGS" });
      return;
    case "SET_GLOBAL_ENABLED":
      await applyCommand(runtime, { type: "SET_GLOBAL_ENABLED", enabled: command.enabled });
      syncSettingsToPage(runtime);
      return;
    case "UPDATE_SETTINGS":
      await applyCommand(runtime, { type: "UPDATE_SETTINGS", settings: command.settings });
      syncSettingsToPage(runtime);
      return;
    case "MANUAL_EMIT":
      await manualEmit(command.eventName, command.detail);
      return;
    case "REPLAY_LOG_RESPONSE":
      await replayLogResponse(command.logId);
      return;
  }
}

async function duplicateSenderById(senderId: string) {
  const sender = runtime.state
    ? getActiveProfileState(runtime.state).senders.find((item) => item.id === senderId)
    : undefined;
  if (!sender) {
    return;
  }

  await applyCommand(runtime, {
    type: "UPSERT_SENDER",
    sender: duplicateSender(sender),
    now: Date.now(),
  });
}

async function triggerResponse(senderId: string, responseId: string) {
  const sender = runtime.state
    ? getActiveProfileState(runtime.state).senders.find((item) => item.id === senderId)
    : undefined;
  const response = sender?.responses.find((item) => item.id === responseId);
  if (!response) {
    return;
  }

  await applyCommand(runtime, {
    type: "APPEND_LOG",
    log: createLogEntry({ type: "EMIT", event: response.eventName, response: response.detail }),
  });
  dispatchToPage(response.eventName, response.detail);
}

async function importSenders(
  senders: BridgeSender[],
  strategy: ImportStrategy,
) {
  const current = runtime.state ? getActiveProfileState(runtime.state).senders : [];
  const merged = mergeImportedSenders(current, senders, strategy);
  await applyCommand(runtime, { type: "REPLACE_SENDERS", senders: merged });
}

async function importRulePackage(
  rulePackage: RulePackage,
  strategy: ImportStrategy,
) {
  if (!runtime.state) {
    return;
  }
  const next = importRulePackageIntoOriginState(
    runtime.state.originState,
    rulePackage,
    strategy,
  );
  await applyCommand(runtime, { type: "REPLACE_ORIGIN_STATE", originState: next });
  syncSettingsToPage(runtime);
}

async function manualEmit(eventName: string, detail: unknown) {
  await applyCommand(runtime, {
    type: "APPEND_LOG",
    log: createLogEntry({ type: "EMIT", event: eventName, response: detail }),
  });
  dispatchToPage(eventName, detail);
}

async function replayLogResponse(logId: string) {
  const log = runtime.state
    ? getActiveProfileState(runtime.state).logs.find((item) => item.id === logId)
    : undefined;
  if (!log?.event) {
    return;
  }

  const detail = sanitizeForStorage(log.response ?? {});
  await applyCommand(runtime, {
    type: "APPEND_LOG",
    log: createLogEntry({ type: "EMIT", event: log.event, response: detail }),
  });
  dispatchToPage(log.event, detail);
}

async function dispatchActiveResponse(senderId: string, responseId: string) {
  const state = runtime.state;
  if (!state || !state.globalEnabled) {
    return;
  }
  const profileState = getActiveProfileState(state);
  if (!profileState.settings.autoMock) {
    return;
  }
  const sender = profileState.senders.find((item) => item.id === senderId);
  if (!sender || sender.activeResponseId !== responseId) {
    return;
  }
  const response = sender.responses.find((item) => item.id === responseId);
  if (!response) {
    return;
  }

  await applyCommand(runtime, {
    type: "APPEND_LOG",
    log: createLogEntry({
      type: "MOCK",
      event: response.eventName,
      response: response.detail,
      ruleId: sender.id,
    }),
  });
  dispatchToPage(response.eventName, response.detail);
}

function isBackgroundCommandMessage(
  message: unknown,
): message is { type: "BACKGROUND_COMMAND"; command: PanelCommand } {
  return (
    typeof message === "object" &&
    message !== null &&
    Reflect.get(message, "type") === "BACKGROUND_COMMAND"
  );
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "未知错误";
}
