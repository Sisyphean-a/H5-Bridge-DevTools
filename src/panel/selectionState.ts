import type { BridgeResponseOption, BridgeSender } from "../shared/senderTypes";
import { isStandaloneSender } from "../shared/standaloneSender";
import type { AppViewState } from "./types";
import { createResponseDraft, createSenderDraft } from "./utils";

export function selectSenderState(
  current: AppViewState,
  sender: BridgeSender,
): AppViewState {
  return {
    ...current,
    selectedSenderId: sender.id,
    senderDraft: createSenderDraft(sender),
    narrowDetailOpen: true,
  };
}

export function openSenderState(
  current: AppViewState,
  sender: BridgeSender,
  rulesSubTab: AppViewState["rulesSubTab"],
): AppViewState {
  const firstResponse = sender.responses[0] ?? null;

  return {
    ...selectSenderState(current, sender),
    activeTab: "rules",
    rulesSubTab,
    selectedResponse: firstResponse
      ? { senderId: sender.id, responseId: firstResponse.id }
      : null,
    responseDraft: firstResponse
      ? createResponseDraft(sender.id, firstResponse)
      : null,
  };
}

export function openResponseState(
  current: AppViewState,
  sender: BridgeSender,
  response: BridgeResponseOption,
  rulesSubTab: AppViewState["rulesSubTab"] = "responses",
): AppViewState {
  const baseState = isStandaloneSender(sender) ? current : selectSenderState(current, sender);
  return {
    ...baseState,
    activeTab: "rules",
    rulesSubTab,
    narrowDetailOpen: true,
    selectedResponse: { senderId: sender.id, responseId: response.id },
    responseDraft: createResponseDraft(sender.id, response),
  };
}
