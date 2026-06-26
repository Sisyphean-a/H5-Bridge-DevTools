import type { BridgePanelSnapshot } from "../shared/bridgeTypes";
import type { AppViewState, ResponseDraft, SenderDraft } from "./types";
import { createResponseDraft, createSenderDraft } from "./utils";

export function syncSnapshotState(
  current: AppViewState,
  snapshot: BridgePanelSnapshot,
): AppViewState {
  const sender = syncSenderDraft(current, snapshot);
  const response = syncResponseDraft(current, snapshot);

  return {
    ...current,
    snapshot,
    selectedSenderId: sender.selectedSenderId,
    senderDraft: sender.senderDraft,
    selectedResponse: response.selectedResponse,
    responseDraft: response.responseDraft,
  };
}

function syncSenderDraft(
  current: AppViewState,
  snapshot: BridgePanelSnapshot,
): Pick<AppViewState, "selectedSenderId" | "senderDraft"> {
  const draft = current.senderDraft;
  if (!draft) {
    return { selectedSenderId: null, senderDraft: null };
  }

  const sender = snapshot.senders.find((item) => item.id === draft.id);
  if (!sender) {
    return { selectedSenderId: draft.id, senderDraft: draft };
  }

  const dirty = isSenderDraftDirty(draft, createSenderDraft(sender));
  return {
    selectedSenderId: sender.id,
    senderDraft: dirty ? draft : createSenderDraft(sender),
  };
}

function syncResponseDraft(
  current: AppViewState,
  snapshot: BridgePanelSnapshot,
): Pick<AppViewState, "selectedResponse" | "responseDraft"> {
  const draft = current.responseDraft;
  const ref = current.selectedResponse;
  if (!draft || !ref) {
    return { selectedResponse: null, responseDraft: null };
  }

  const sender = snapshot.senders.find((item) => item.id === ref.senderId);
  const response = sender?.responses.find((item) => item.id === ref.responseId);
  if (!sender || !response) {
    return { selectedResponse: ref, responseDraft: draft };
  }

  const dirty = isResponseDraftDirty(draft, createResponseDraft(sender.id, response));
  return {
    selectedResponse: ref,
    responseDraft: dirty ? draft : createResponseDraft(sender.id, response),
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
