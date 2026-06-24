import { SOURCE_PAGE } from "../shared/constants";
import { createId } from "../shared/id";
import type {
  BackgroundToContentMessage,
  PageBridgeCallMessage,
  PanelCommand,
} from "../shared/messageTypes";
import { cloneJson } from "../shared/json";
import { findMatchingRule, mergeImportedRules } from "../shared/rules";
import {
  appendLog,
  dispatchToPage,
  initializeRuntime,
  mutateRuntime,
  postContentMessage,
  publishSnapshot,
  readEventName,
  type ContentRuntime,
  type RuntimeState,
  syncSettingsToPage,
  trimLogs,
} from "./runtime";

const runtime = createRuntime();

export function bootstrapContentScript(): void {
  runtime.ready = initialize().then((snapshot) => {
    postContentMessage(runtime, { type: "CONTENT_READY", snapshot });
  });

  runtime.port.onMessage.addListener((message: BackgroundToContentMessage) => {
    void runtime.ready.then(() => handlePanelCommand(message.command));
  });

  window.addEventListener("message", (event) => {
    void runtime.ready.then(() => handlePageMessage(event));
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

  const matchedRule = findMatchingRule(runtime.state.originState.rules, eventName);
  if (!matchedRule) {
    await pushWarn(eventName, payload);
    return;
  }

  await updateRuleHitCount(matchedRule.id);
  window.setTimeout(() => {
    void dispatchMockFromRule(matchedRule.id);
  }, matchedRule.response.delayMs);
}

async function handlePanelCommand(command: PanelCommand): Promise<void> {
  switch (command.type) {
    case "REQUEST_SNAPSHOT":
      publishSnapshot(runtime);
      return;
    case "UPSERT_RULE":
      await upsertRule(command.rule);
      return;
    case "DELETE_RULE":
      await deleteRule(command.ruleId);
      return;
    case "DUPLICATE_RULE":
      await duplicateRuleById(command.ruleId);
      return;
    case "TOGGLE_RULE":
      await toggleRule(command.ruleId, command.enabled);
      return;
    case "IMPORT_RULES":
      await importRules(command.rules, command.strategy);
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

async function upsertRule(rule: RuntimeState["originState"]["rules"][number]) {
  await mutateRuntime(runtime, async (state) => {
    const nextRule = {
      ...cloneJson(rule),
      meta: {
        ...rule.meta,
        createdAt: rule.meta?.createdAt ?? Date.now(),
        updatedAt: Date.now(),
        hitCount: rule.meta?.hitCount ?? 0,
      },
    };
    const index = state.originState.rules.findIndex((item) => item.id === rule.id);
    state.originState.rules =
      index >= 0
        ? state.originState.rules.map((item, itemIndex) =>
            itemIndex === index ? nextRule : item,
          )
        : [...state.originState.rules, nextRule];
  });
}

async function deleteRule(ruleId: string) {
  await mutateRuntime(runtime, async (state) => {
    state.originState.rules = state.originState.rules.filter((rule) => rule.id !== ruleId);
  });
}

async function duplicateRuleById(ruleId: string) {
  await mutateRuntime(runtime, async (state) => {
    const sourceRule = state.originState.rules.find((rule) => rule.id === ruleId);
    if (!sourceRule) {
      return;
    }

    const copy = cloneJson(sourceRule);
    copy.id = createId("rule");
    copy.name = `${sourceRule.name} 副本`;
    copy.meta = {
      createdAt: Date.now(),
      updatedAt: Date.now(),
      hitCount: 0,
    };
    state.originState.rules = [...state.originState.rules, copy];
  });
}

async function toggleRule(ruleId: string, enabled: boolean) {
  await mutateRuntime(runtime, async (state) => {
    state.originState.rules = state.originState.rules.map((rule) =>
      rule.id === ruleId
        ? {
            ...rule,
            enabled,
            meta: {
              ...rule.meta,
              updatedAt: Date.now(),
            },
          }
        : rule,
    );
  });
}

async function importRules(
  rules: RuntimeState["originState"]["rules"],
  strategy: "merge" | "replace" | "appendDisabled",
) {
  await mutateRuntime(runtime, async (state) => {
    state.originState.rules = mergeImportedRules(
      state.originState.rules,
      rules,
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

async function updateSettings(settings: Partial<RuntimeState["originState"]["settings"]>) {
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

async function dispatchMockFromRule(ruleId: string) {
  const activeRule = runtime.state?.originState.rules.find((rule) => rule.id === ruleId);
  if (!activeRule || !runtime.state?.globalEnabled) {
    return;
  }

  dispatchToPage(activeRule.response.eventName, activeRule.response.detail);
  await mutateRuntime(runtime, async (state) => {
    state.originState.logs = appendLog(state, {
      type: "MOCK",
      event: activeRule.response.eventName,
      response: activeRule.response.detail,
      ruleId: activeRule.id,
    });
  });
}

async function updateRuleHitCount(ruleId: string) {
  await mutateRuntime(runtime, async (state) => {
    state.originState.rules = state.originState.rules.map((rule) =>
      rule.id === ruleId
        ? {
            ...rule,
            meta: {
              ...rule.meta,
              updatedAt: Date.now(),
              hitCount: (rule.meta?.hitCount ?? 0) + 1,
            },
          }
        : rule,
    );
  });
}

async function pushWarn(eventName: string, payload: unknown) {
  await mutateRuntime(runtime, async (state) => {
    state.originState.logs = appendLog(state, {
      type: "WARN",
      event: eventName,
      payload,
      message: `No mock rule matched for event "${eventName}".`,
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
