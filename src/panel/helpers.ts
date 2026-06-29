import type { BridgePanelSnapshot } from "../shared/bridgeTypes";
import { syncNavigationSnapshotState } from "./navigationState";
import type { AppViewState, ResponseDraft, SenderDraft } from "./types";
import { createResponseDraft, createSenderDraft } from "./utils";

export function syncSnapshotState(
  current: AppViewState,
  snapshot: BridgePanelSnapshot,
): AppViewState {
  const senderState = syncSenderDraft(current, snapshot);
  const responseState = syncResponseDraft(current, snapshot);
  const toast = buildRemoteUpdateToast(senderState, responseState);

  const next = {
    ...current,
    snapshot,
    selectedSenderId: senderState.selectedSenderId,
    senderDraft: senderState.senderDraft,
    selectedResponse: responseState.selectedResponse,
    responseDraft: responseState.responseDraft,
    toast: toast ?? current.toast,
  };
  return syncNavigationSnapshotState(current, next);
}

function syncSenderDraft(
  current: AppViewState,
  snapshot: BridgePanelSnapshot,
): Pick<AppViewState, "selectedSenderId" | "senderDraft"> & {
  preservedRemoteUpdate: boolean;
} {
  const selectedSenderId = current.selectedSenderId;
  const draft = current.senderDraft;
  const sender = selectedSenderId
    ? snapshot.senders.find((item) => item.id === selectedSenderId)
    : null;
  if (!draft) {
    return sender
      ? {
          selectedSenderId: sender.id,
          senderDraft: createSenderDraft(sender),
          preservedRemoteUpdate: false,
        }
      : { selectedSenderId: null, senderDraft: null, preservedRemoteUpdate: false };
  }
  if (!sender) {
    return {
      selectedSenderId: selectedSenderId ?? draft.id,
      senderDraft: draft,
      preservedRemoteUpdate: false,
    };
  }

  const freshDraft = createSenderDraft(sender);
  const previousSender = current.snapshot?.senders.find((item) => item.id === sender.id);
  const previousDraft = previousSender ? createSenderDraft(previousSender) : null;
  const hasLocalEdits = previousDraft ? isSenderDraftDirty(draft, previousDraft) : true;
  return {
    selectedSenderId: sender.id,
    senderDraft: hasLocalEdits ? draft : freshDraft,
    preservedRemoteUpdate:
      hasLocalEdits && didSenderChange(previousDraft, freshDraft),
  };
}

function syncResponseDraft(
  current: AppViewState,
  snapshot: BridgePanelSnapshot,
): Pick<AppViewState, "selectedResponse" | "responseDraft"> & {
  preservedRemoteUpdate: boolean;
} {
  const draft = current.responseDraft;
  const ref = current.selectedResponse;
  if (!ref) {
    return { selectedResponse: null, responseDraft: null, preservedRemoteUpdate: false };
  }

  const sender = snapshot.senders.find((item) => item.id === ref.senderId);
  const response = sender?.responses.find((item) => item.id === ref.responseId);
  if (!draft) {
    return sender && response
      ? {
          selectedResponse: ref,
          responseDraft: createResponseDraft(sender.id, response),
          preservedRemoteUpdate: false,
        }
      : { selectedResponse: null, responseDraft: null, preservedRemoteUpdate: false };
  }
  if (!sender || !response) {
    return { selectedResponse: ref, responseDraft: draft, preservedRemoteUpdate: false };
  }

  const freshDraft = createResponseDraft(sender.id, response);
  const previousSender = current.snapshot?.senders.find((item) => item.id === ref.senderId);
  const previousResponse = previousSender?.responses.find((item) => item.id === ref.responseId);
  const previousDraft = previousResponse ? createResponseDraft(ref.senderId, previousResponse) : null;
  const hasLocalEdits = previousDraft ? isResponseDraftDirty(draft, previousDraft) : true;
  return {
    selectedResponse: ref,
    responseDraft: hasLocalEdits ? draft : freshDraft,
    preservedRemoteUpdate:
      hasLocalEdits && didResponseChange(previousDraft, freshDraft),
  };
}

function isSenderDraftDirty(draft: SenderDraft, fresh: SenderDraft): boolean {
  return draft.name !== fresh.name || draft.matchEvent !== fresh.matchEvent;
}

function isResponseDraftDirty(draft: ResponseDraft, fresh: ResponseDraft): boolean {
  return (
    draft.name !== fresh.name ||
    draft.delayMs !== fresh.delayMs ||
    draft.mode !== fresh.mode ||
    draft.eventName !== fresh.eventName ||
    draft.detailText !== fresh.detailText
  );
}

function buildRemoteUpdateToast(
  senderState: { preservedRemoteUpdate: boolean },
  responseState: { preservedRemoteUpdate: boolean },
): AppViewState["toast"] | null {
  if (responseState.preservedRemoteUpdate) {
    return {
      level: "info",
      message: "已收到远端响应更新，当前保留本地未保存草稿。",
    };
  }
  if (senderState.preservedRemoteUpdate) {
    return {
      level: "info",
      message: "已收到远端发送更新，当前保留本地未保存草稿。",
    };
  }
  return null;
}

function didSenderChange(previous: SenderDraft | null, next: SenderDraft): boolean {
  if (!previous) {
    return true;
  }
  return isSenderDraftDirty(previous, next);
}

function didResponseChange(previous: ResponseDraft | null, next: ResponseDraft): boolean {
  if (!previous) {
    return true;
  }
  return isResponseDraftDirty(previous, next);
}

export function hasActiveExtensionRuntime(
  runtime: Partial<Pick<typeof chrome.runtime, "sendMessage" | "id">> | undefined,
): runtime is Pick<typeof chrome.runtime, "sendMessage" | "id"> {
  return typeof runtime?.sendMessage === "function" && typeof runtime.id === "string" && runtime.id.length > 0;
}

export function isExtensionContextInvalidatedError(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.message.includes("Extension context invalidated")
  );
}
