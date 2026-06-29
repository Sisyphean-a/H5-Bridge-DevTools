import type {
  BackgroundToContentMessage,
  PanelCommand,
  PanelCommandRequest,
  PanelCommandResponse,
} from "../shared/messageTypes";

const CONTENT_SCRIPT_FILES = ["injected/injectMain.js", "content/contentScript.js"] as const;

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!isPanelCommandRequest(message)) {
    return;
  }

  void dispatchPanelCommand(message).then(sendResponse);
  return true;
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

function isPanelCommandRequest(message: unknown): message is PanelCommandRequest {
  return (
    typeof message === "object" &&
    message !== null &&
    Reflect.get(message, "type") === "PANEL_COMMAND" &&
    typeof Reflect.get(message, "tabId") === "number"
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
