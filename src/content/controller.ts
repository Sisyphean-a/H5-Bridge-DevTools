import { SOURCE_PAGE } from "../shared/constants";
import type { BridgeProfileId } from "../shared/bridgeProfiles";
import type {
  PageBridgeCallMessage,
  PanelCommand,
  PanelCommandResponse,
} from "../shared/messageTypes";
import { cloneJson } from "../shared/json";
import { findMatchingSender, getActiveResponse } from "../shared/rules";
import type { ImportStrategy, OriginBridgeSettings } from "../shared/ruleTypes";
import type { BridgeResponseOption, BridgeSender } from "../shared/senderTypes";
import {
  appendLog,
  dispatchToPage,
  getActiveProfileState,
  initializeRuntime,
  mutateRuntime,
  readEventName,
  setActiveProfile,
  syncRuntimeFromStorageChange,
  type ContentRuntime,
  syncSettingsToPage,
  trimLogs,
} from "./runtime";
import {
  deleteResponseState,
  deleteSenderState,
  duplicateSenderState,
  importSendersState,
  setActiveResponseState,
  updateHitCountState,
  upsertResponseState,
  upsertSenderState,
} from "./senderState";

const runtime = createRuntime();

export function bootstrapContentScript(): void {
  runtime.ready = initialize().then(() => undefined);
  chrome.runtime.onMessage.addListener(handleRuntimeMessage);
  chrome.storage.onChanged.addListener(handleStorageChange);
  window.addEventListener("message", handleWindowMessage);
}

async function initialize() {
  return initializeRuntime(runtime);
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
  void runtime.ready.then(() => syncRuntimeFromStorageChange(runtime, changes, areaName));
}

function handleWindowMessage(event: MessageEvent<PageBridgeCallMessage>): void {
  void runtime.ready.then(() => handlePageMessage(event));
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
  const parsed = message.payload.parsedMessage;
  const eventName = readEventName(parsed);
  const payload = parsed ?? message.payload.rawMessage;

  await mutateRuntime(runtime, async (state) => {
    getActiveProfileState(state).logs = appendLog(state, {
      type: "SEND",
      event: eventName,
      payload,
    });
  });

  if (!eventName) {
    await pushError("Bridge message has no event field.", payload);
    return;
  }
  if (!runtime.state?.globalEnabled || !getActiveProfileState(runtime.state).settings.autoMock) {
    return;
  }

  const matchedSender = findMatchingSender(getActiveProfileState(runtime.state).senders, eventName);
  if (!matchedSender) {
    await pushWarn(eventName, payload, `No sender matched for event "${eventName}".`);
    return;
  }

  const activeResponse = getActiveResponse(matchedSender);
  if (!activeResponse) {
    await pushWarn(
      eventName,
      payload,
      `Sender "${matchedSender.name}" has no active response.`,
    );
    return;
  }

  await updateHitCount(matchedSender.id, activeResponse.id);
  const senderId = matchedSender.id;
  const responseId = activeResponse.id;
  window.setTimeout(() => {
    void dispatchActiveResponse(senderId, responseId);
  }, activeResponse.delayMs);
}

async function handlePanelCommand(command: PanelCommand): Promise<void> {
  switch (command.type) {
    case "REQUEST_SNAPSHOT":
      return;
    case "SET_ACTIVE_PROFILE":
      await changeActiveProfile(command.profileId);
      return;
    case "UPSERT_SENDER":
      await upsertSender(command.sender);
      return;
    case "DELETE_SENDER":
      await deleteSender(command.senderId);
      return;
    case "DUPLICATE_SENDER":
      await duplicateSenderById(command.senderId);
      return;
    case "SET_ACTIVE_RESPONSE":
      await setActiveResponse(command.senderId, command.responseId);
      return;
    case "UPSERT_RESPONSE":
      await upsertResponse(command.senderId, command.response);
      return;
    case "DELETE_RESPONSE":
      await deleteResponse(command.senderId, command.responseId);
      return;
    case "TRIGGER_RESPONSE":
      await triggerResponse(command.senderId, command.responseId);
      return;
    case "IMPORT_SENDERS":
      await importSenders(command.senders, command.strategy);
      return;
    case "CLEAR_LOGS":
      await clearLogs();
      return;
    case "SET_GLOBAL_ENABLED":
      await setGlobalEnabled(command.enabled);
      return;
    case "UPDATE_SETTINGS":
      await updateSettings(command.settings);
      return;
    case "MANUAL_EMIT":
      await manualEmit(command.eventName, command.detail);
      return;
    case "REPLAY_LOG_RESPONSE":
      await replayLogResponse(command.logId);
      return;
  }
}

async function upsertSender(sender: BridgeSender) {
  const now = Date.now();
  await updateSenders((senders) => upsertSenderState(senders, sender, now));
}

async function deleteSender(senderId: string) {
  await updateSenders((senders) => deleteSenderState(senders, senderId));
}

async function duplicateSenderById(senderId: string) {
  await updateSenders((senders) => duplicateSenderState(senders, senderId));
}

async function setActiveResponse(senderId: string, responseId: string | null) {
  const now = Date.now();
  await updateSenders((senders) =>
    setActiveResponseState(senders, senderId, responseId, now),
  );
}

async function upsertResponse(senderId: string, response: BridgeResponseOption) {
  const now = Date.now();
  await updateSenders((senders) => upsertResponseState(senders, senderId, response, now));
}

async function deleteResponse(senderId: string, responseId: string) {
  await updateSenders((senders) => deleteResponseState(senders, senderId, responseId));
}

async function triggerResponse(senderId: string, responseId: string) {
  const sender = runtime.state
    ? getActiveProfileState(runtime.state).senders.find((item) => item.id === senderId)
    : undefined;
  const response = sender?.responses.find((item) => item.id === responseId);
  if (!response) {
    return;
  }

  dispatchToPage(response.eventName, response.detail);
  await mutateRuntime(runtime, async (state) => {
    getActiveProfileState(state).logs = appendLog(state, {
      type: "EMIT",
      event: response.eventName,
      response: response.detail,
    });
  });
}

async function importSenders(
  senders: BridgeSender[],
  strategy: ImportStrategy,
) {
  await updateSenders((current) => importSendersState(current, senders, strategy));
}

async function clearLogs() {
  await mutateRuntime(runtime, async (state) => {
    getActiveProfileState(state).logs = [];
  });
}

async function changeActiveProfile(profileId: BridgeProfileId) {
  await mutateRuntime(runtime, async (state) => {
    setActiveProfile(state, profileId);
  });
  syncSettingsToPage(runtime);
}

async function setGlobalEnabled(enabled: boolean) {
  await mutateRuntime(runtime, async (state) => {
    state.globalEnabled = enabled;
  });
  syncSettingsToPage(runtime);
}

async function updateSettings(settings: Partial<OriginBridgeSettings>) {
  await mutateRuntime(runtime, async (state) => {
    const profileState = getActiveProfileState(state);
    profileState.settings = {
      ...profileState.settings,
      ...settings,
    };
    profileState.logs = trimLogs(
      profileState.logs,
      profileState.settings.maxLogCount,
    );
  });
  syncSettingsToPage(runtime);
}

async function manualEmit(eventName: string, detail: unknown) {
  dispatchToPage(eventName, detail);
  await mutateRuntime(runtime, async (state) => {
    getActiveProfileState(state).logs = appendLog(state, {
      type: "EMIT",
      event: eventName,
      response: detail,
    });
  });
}

async function replayLogResponse(logId: string) {
  const log = runtime.state
    ? getActiveProfileState(runtime.state).logs.find((item) => item.id === logId)
    : undefined;
  if (!log?.event) {
    return;
  }

  await manualEmit(log.event, cloneJson(log.response ?? {}));
}

async function dispatchActiveResponse(senderId: string, responseId: string) {
  const sender = runtime.state
    ? getActiveProfileState(runtime.state).senders.find((item) => item.id === senderId)
    : undefined;
  const response = sender?.responses.find((item) => item.id === responseId);
  if (!sender || !response || !runtime.state?.globalEnabled) {
    return;
  }

  dispatchToPage(response.eventName, response.detail);
  await mutateRuntime(runtime, async (state) => {
    getActiveProfileState(state).logs = appendLog(state, {
      type: "MOCK",
      event: response.eventName,
      response: response.detail,
      ruleId: sender.id,
    });
  });
}

async function updateHitCount(senderId: string, responseId: string) {
  const now = Date.now();
  await updateSenders((senders) => updateHitCountState(senders, senderId, responseId, now));
}

async function pushWarn(eventName: string, payload: unknown, message: string) {
  await mutateRuntime(runtime, async (state) => {
    getActiveProfileState(state).logs = appendLog(state, {
      type: "WARN",
      event: eventName,
      payload,
      message,
    });
  });
}

async function pushError(message: string, payload: unknown) {
  await mutateRuntime(runtime, async (state) => {
    getActiveProfileState(state).logs = appendLog(state, {
      type: "ERROR",
      payload,
      message,
    });
  });
}

async function updateSenders(
  updater: (senders: BridgeSender[]) => BridgeSender[],
): Promise<void> {
  await mutateRuntime(runtime, async (state) => {
    const profileState = getActiveProfileState(state);
    profileState.senders = updater(profileState.senders);
  });
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
