import type {
  ApplyStateCommandRequest,
  BackgroundToContentMessage,
  PanelCommand,
  PanelCommandRequest,
  PanelCommandResponse,
} from "../shared/messageTypes";
import {
  applyCommandToRuntimeState,
  type StateCommand,
} from "../shared/stateCommands";
import {
  createDefaultOriginState,
  readStorageStateForWrite,
  writeStorageState,
} from "../shared/storage";

const CONTENT_SCRIPT_FILES = ["injected/injectMain.js", "content/contentScript.js"] as const;

/** 状态写入必须串行：chrome.storage 没有事务，并发读改写会互相覆盖。 */
let stateWriteQueue: Promise<void> = Promise.resolve();

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (isPanelCommandRequest(message)) {
    void dispatchPanelCommand(message).then(sendResponse);
    return true;
  }
  if (isApplyStateCommandRequest(message)) {
    return enqueueStateCommand(message, sendResponse);
  }
  return;
});

async function dispatchPanelCommand(
  message: PanelCommandRequest,
): Promise<PanelCommandResponse> {
  try {
    await sendCommandToTab(message.tabId, message.command);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      message: toErrorMessage(error),
    };
  }
}

async function sendCommandToTab(tabId: number, command: PanelCommand): Promise<void> {
  const payload: BackgroundToContentMessage = {
    type: "BACKGROUND_COMMAND",
    command,
  };

  try {
    await chrome.tabs.sendMessage(tabId, payload);
  } catch (error) {
    if (!isMissingReceiverError(error)) {
      throw error;
    }

    await injectContentScripts(tabId);
    await chrome.tabs.sendMessage(tabId, payload);
  }
}

async function injectContentScripts(tabId: number): Promise<void> {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: [CONTENT_SCRIPT_FILES[0]],
    world: "MAIN",
  });
  await chrome.scripting.executeScript({
    target: { tabId },
    files: [CONTENT_SCRIPT_FILES[1]],
  });
}

/**
 * 内容脚本的状态增量命令在这里串行执行：
 * 每个命令读到最新存储、应用同一确定命令、再写回，
 * 消除多标签页并发读改写导致的丢失更新。
 */
function enqueueStateCommand(
  message: ApplyStateCommandRequest,
  sendResponse: (response: PanelCommandResponse) => void,
): boolean {
  stateWriteQueue = stateWriteQueue
    .then(() => applyStateCommandToStorage(message.origin, message.command))
    .then(() => {
      sendResponse({ ok: true });
    })
    .catch((error: unknown) => {
      console.warn("[H5Bridge] 状态命令执行失败。", error);
      sendResponse({ ok: false, message: toErrorMessage(error) });
    });
  return true;
}

async function applyStateCommandToStorage(
  origin: string,
  command: StateCommand,
): Promise<void> {
  const current = await readStorageStateForWrite();
  const originState = current.origins[origin] ?? createDefaultOriginState();
  const working = {
    globalEnabled: current.globalEnabled ?? true,
    originState,
  };
  applyCommandToRuntimeState(working, command);
  await writeStorageState({
    ...current,
    globalEnabled: working.globalEnabled,
    origins: {
      ...current.origins,
      [origin]: working.originState,
    },
  });
}

function isPanelCommandRequest(message: unknown): message is PanelCommandRequest {
  return (
    typeof message === "object" &&
    message !== null &&
    Reflect.get(message, "type") === "PANEL_COMMAND" &&
    typeof Reflect.get(message, "tabId") === "number"
  );
}

function isApplyStateCommandRequest(message: unknown): message is ApplyStateCommandRequest {
  return (
    typeof message === "object" &&
    message !== null &&
    Reflect.get(message, "type") === "APPLY_STATE_COMMAND" &&
    typeof Reflect.get(message, "origin") === "string" &&
    Reflect.get(message, "origin") !== "" &&
    typeof Reflect.get(message, "command") === "object" &&
    Reflect.get(message, "command") !== null
  );
}

function isMissingReceiverError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.message.includes("Receiving end does not exist") ||
      error.message.includes("Could not establish connection"))
  );
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "未知错误";
}
