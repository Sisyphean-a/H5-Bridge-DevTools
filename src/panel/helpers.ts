import type { BridgePanelSnapshot } from "../shared/bridgeTypes";
import type { AppViewState, ResponseDraft, SenderDraft } from "./types";
import { createResponseDraft, createSenderDraft } from "./utils";

export function syncSnapshotState(
  current: AppViewState,
  snapshot: BridgePanelSnapshot,
): AppViewState {
  const senderState = syncSenderDraft(current, snapshot);
  const responseState = syncResponseDraft(current, snapshot);

  return {
    ...current,
    snapshot,
    selectedSenderId: senderState.selectedSenderId,
    senderDraft: senderState.senderDraft,
    selectedResponse: responseState.selectedResponse,
    responseDraft: responseState.responseDraft,
  };
}

function syncSenderDraft(
  current: AppViewState,
  snapshot: BridgePanelSnapshot,
): Pick<AppViewState, "selectedSenderId" | "senderDraft"> {
  const selectedSenderId = current.selectedSenderId;
  const draft = current.senderDraft;
  const sender = selectedSenderId
    ? snapshot.senders.find((item) => item.id === selectedSenderId)
    : null;
  if (!draft) {
    return sender
      ? { selectedSenderId: sender.id, senderDraft: createSenderDraft(sender) }
      : { selectedSenderId: null, senderDraft: null };
  }
  if (!sender) {
    return { selectedSenderId: selectedSenderId ?? draft.id, senderDraft: draft };
  }

  const freshDraft = createSenderDraft(sender);
  const dirty = isSenderDraftDirty(draft, freshDraft);
  return {
    selectedSenderId: sender.id,
    senderDraft: dirty ? draft : freshDraft,
  };
}

function syncResponseDraft(
  current: AppViewState,
  snapshot: BridgePanelSnapshot,
): Pick<AppViewState, "selectedResponse" | "responseDraft"> {
  const draft = current.responseDraft;
  const ref = current.selectedResponse;
  if (!ref) {
    return { selectedResponse: null, responseDraft: null };
  }

  const sender = snapshot.senders.find((item) => item.id === ref.senderId);
  const response = sender?.responses.find((item) => item.id === ref.responseId);
  if (!draft) {
    return sender && response
      ? {
          selectedResponse: ref,
          responseDraft: createResponseDraft(sender.id, response),
        }
      : { selectedResponse: null, responseDraft: null };
  }
  if (!sender || !response) {
    return { selectedResponse: ref, responseDraft: draft };
  }

  const freshDraft = createResponseDraft(sender.id, response);
  const dirty = isResponseDraftDirty(draft, freshDraft);
  return {
    selectedResponse: ref,
    responseDraft: dirty ? draft : freshDraft,
  };
}

function isSenderDraftDirty(draft: SenderDraft, fresh: SenderDraft): boolean {
  return (
    draft.name !== fresh.name ||
    draft.enabled !== fresh.enabled ||
    draft.matchEvent !== fresh.matchEvent
  );
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

export function requestSnapshot(port: chrome.runtime.Port, tabId: number): void {
  port.postMessage({
    type: "PANEL_COMMAND",
    tabId,
    command: { type: "REQUEST_SNAPSHOT" },
  });
}
