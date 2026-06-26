import { SOURCE_PAGE } from "../shared/constants";
import type {
  BackgroundToContentMessage,
  PageBridgeCallMessage,
  PanelCommand,
} from "../shared/messageTypes";
import { cloneJson } from "../shared/json";
import {
  duplicateSender,
  findMatchingSender,
  getActiveResponse,
  mergeImportedSenders,
} from "../shared/rules";
import type { OriginBridgeSettings } from "../shared/ruleTypes";
import type { BridgeResponseOption, BridgeSender } from "../shared/senderTypes";
import {
  appendLog,
  dispatchToPage,
  initializeRuntime,
  mutateRuntime,
  postContentMessage,
  publishSnapshot,
  readEventName,
  type ContentRuntime,
  syncSettingsToPage,
  trimLogs,
} from "./runtime";

const runtime = createRuntime();

export function bootstrapContentScript(): void {
  const handlePortMessage = (message: BackgroundToContentMessage) => {
    if (!runtime.portConnected) {
      return;
    }
    void runtime.ready.then(() => handlePanelCommand(message.command));
  };

  const handleWindowMessage = (event: MessageEvent<PageBridgeCallMessage>) => {
    if (!runtime.portConnected) {
      return;
    }
    void runtime.ready.then(() => handlePageMessage(event));
  };

  runtime.ready = initialize().then((snapshot) => {
    postContentMessage(runtime, { type: "CONTENT_READY", snapshot });
  });

  runtime.port.onMessage.addListener(handlePortMessage);
  window.addEventListener("message", handleWindowMessage);

  runtime.port.onDisconnect.addListener(() => {
    runtime.port.onMessage.removeListener(handlePortMessage);
    window.removeEventListener("message", handleWindowMessage);
  });
}

async function initialize() {
  return initializeRuntime(runtime);
}

function createRuntime(): ContentRuntime {
  const port = chrome.runtime.connect({ name: "h5-bridge-content" });
  const runtime: ContentRuntime = {
    port,
    portConnected: true,
    state: null,
    ready: Promise.resolve(),
    chain: Promise.resolve(),
  };

  port.onDisconnect.addListener(() => {
    if (runtime.port !== port) {
      return;
    }
    runtime.portConnected = false;
  });

  return runtime;
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
    state.originState.logs = appendLog(state, {
      type: "SEND",
      event: eventName,
      payload,
    });
  });

  if (!eventName) {
    await pushError("Bridge message has no event field.", payload);
    return;
  }
  if (!runtime.state?.originState.settings.autoMock || !runtime.state.globalEnabled) {
    return;
  }

  const matchedSender = findMatchingSender(runtime.state.originState.senders, eventName);
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
      publishSnapshot(runtime);
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
    case "TOGGLE_SENDER":
      await toggleSender(command.senderId, command.enabled);
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
  await mutateRuntime(runtime, async (state) => {
    const nextSender: BridgeSender = {
      ...cloneJson(sender),
      meta: {
        ...sender.meta,
        createdAt: sender.meta?.createdAt ?? Date.now(),
        updatedAt: Date.now(),
        hitCount: sender.meta?.hitCount ?? 0,
      },
    };
    const index = state.originState.senders.findIndex((item) => item.id === sender.id);
    state.originState.senders =
      index >= 0
        ? state.originState.senders.map((item, itemIndex) =>
            itemIndex === index ? nextSender : item,
          )
        : [...state.originState.senders, nextSender];
  });
}

async function deleteSender(senderId: string) {
  await mutateRuntime(runtime, async (state) => {
    state.originState.senders = state.originState.senders.filter(
      (sender) => sender.id !== senderId,
    );
  });
}

async function duplicateSenderById(senderId: string) {
  await mutateRuntime(runtime, async (state) => {
    const source = state.originState.senders.find((sender) => sender.id === senderId);
    if (!source) {
      return;
    }
    state.originState.senders = [...state.originState.senders, duplicateSender(source)];
  });
}

async function toggleSender(senderId: string, enabled: boolean) {
  await mutateRuntime(runtime, async (state) => {
    state.originState.senders = state.originState.senders.map((sender) =>
      sender.id === senderId
        ? {
            ...sender,
            enabled,
            meta: { ...sender.meta, updatedAt: Date.now() },
          }
        : sender,
    );
  });
}

async function setActiveResponse(senderId: string, responseId: string | null) {
  await mutateRuntime(runtime, async (state) => {
    state.originState.senders = state.originState.senders.map((sender) => {
      if (sender.id !== senderId) {
        return sender;
      }
      const nextActiveId =
        responseId === null
          ? null
          : sender.responses.some((response) => response.id === responseId)
            ? responseId
            : sender.activeResponseId;
      return {
        ...sender,
        activeResponseId: nextActiveId,
        meta: { ...sender.meta, updatedAt: Date.now() },
      };
    });
  });
}

async function upsertResponse(senderId: string, response: BridgeResponseOption) {
  await mutateRuntime(runtime, async (state) => {
    state.originState.senders = state.originState.senders.map((sender) => {
      if (sender.id !== senderId) {
        return sender;
      }
      const nextResponse: BridgeResponseOption = {
        ...cloneJson(response),
        meta: {
          ...response.meta,
          createdAt: response.meta?.createdAt ?? Date.now(),
          updatedAt: Date.now(),
          hitCount: response.meta?.hitCount ?? 0,
        },
      };
      const index = sender.responses.findIndex((item) => item.id === response.id);
      const wasEmpty = sender.responses.length === 0;
      const responses =
        index >= 0
          ? sender.responses.map((item, itemIndex) =>
              itemIndex === index ? nextResponse : item,
            )
          : [...sender.responses, nextResponse];
      const activeResponseId =
        index < 0 && wasEmpty ? nextResponse.id : sender.activeResponseId;
      return { ...sender, responses, activeResponseId };
    });
  });
}

async function deleteResponse(senderId: string, responseId: string) {
  await mutateRuntime(runtime, async (state) => {
    state.originState.senders = state.originState.senders.map((sender) => {
      if (sender.id !== senderId) {
        return sender;
      }
      const responses = sender.responses.filter((item) => item.id !== responseId);
      const activeResponseId =
        sender.activeResponseId === responseId ? null : sender.activeResponseId;
      return { ...sender, responses, activeResponseId };
    });
  });
}

async function triggerResponse(senderId: string, responseId: string) {
  const sender = runtime.state?.originState.senders.find((item) => item.id === senderId);
  const response = sender?.responses.find((item) => item.id === responseId);
  if (!response) {
    return;
  }

  dispatchToPage(response.eventName, response.detail);
  await mutateRuntime(runtime, async (state) => {
    state.originState.logs = appendLog(state, {
      type: "EMIT",
      event: response.eventName,
      response: response.detail,
    });
  });
}

async function importSenders(
  senders: BridgeSender[],
  strategy: "merge" | "replace" | "appendDisabled",
) {
  await mutateRuntime(runtime, async (state) => {
    state.originState.senders = mergeImportedSenders(
      state.originState.senders,
      senders,
      strategy,
    );
  });
}

async function clearLogs() {
  await mutateRuntime(runtime, async (state) => {
    state.originState.logs = [];
  });
}

async function setGlobalEnabled(enabled: boolean) {
  await mutateRuntime(runtime, async (state) => {
    state.globalEnabled = enabled;
  });
  syncSettingsToPage(runtime);
}

async function updateSettings(settings: Partial<OriginBridgeSettings>) {
  await mutateRuntime(runtime, async (state) => {
    state.originState.settings = {
      ...state.originState.settings,
      ...settings,
    };
    state.originState.logs = trimLogs(
      state.originState.logs,
      state.originState.settings.maxLogCount,
    );
  });
  syncSettingsToPage(runtime);
}

async function manualEmit(eventName: string, detail: unknown) {
  dispatchToPage(eventName, detail);
  await mutateRuntime(runtime, async (state) => {
    state.originState.logs = appendLog(state, {
      type: "EMIT",
      event: eventName,
      response: detail,
    });
  });
}

async function replayLogResponse(logId: string) {
  const log = runtime.state?.originState.logs.find((item) => item.id === logId);
  if (!log?.event) {
    return;
  }

  await manualEmit(log.event, cloneJson(log.response ?? {}));
}

async function dispatchActiveResponse(senderId: string, responseId: string) {
  const sender = runtime.state?.originState.senders.find((item) => item.id === senderId);
  const response = sender?.responses.find((item) => item.id === responseId);
  if (!sender || !response || !runtime.state?.globalEnabled) {
    return;
  }

  dispatchToPage(response.eventName, response.detail);
  await mutateRuntime(runtime, async (state) => {
    state.originState.logs = appendLog(state, {
      type: "MOCK",
      event: response.eventName,
      response: response.detail,
      ruleId: sender.id,
    });
  });
}

async function updateHitCount(senderId: string, responseId: string) {
  await mutateRuntime(runtime, async (state) => {
    state.originState.senders = state.originState.senders.map((sender) =>
      sender.id === senderId
        ? {
            ...sender,
            responses: sender.responses.map((response) =>
              response.id === responseId
                ? {
                    ...response,
                    meta: {
                      ...response.meta,
                      updatedAt: Date.now(),
                      hitCount: (response.meta?.hitCount ?? 0) + 1,
                    },
                  }
                : response,
            ),
            meta: {
              ...sender.meta,
              updatedAt: Date.now(),
              hitCount: (sender.meta?.hitCount ?? 0) + 1,
            },
          }
        : sender,
    );
  });
}

async function pushWarn(eventName: string, payload: unknown, message: string) {
  await mutateRuntime(runtime, async (state) => {
    state.originState.logs = appendLog(state, {
      type: "WARN",
      event: eventName,
      payload,
      message,
    });
  });
}

async function pushError(message: string, payload: unknown) {
  await mutateRuntime(runtime, async (state) => {
    state.originState.logs = appendLog(state, {
      type: "ERROR",
      payload,
      message,
    });
  });
}
