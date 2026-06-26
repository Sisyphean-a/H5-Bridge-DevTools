import type { BridgeSender, BridgeResponseOption } from "../shared/senderTypes";
import { formatJson, safeParseJson } from "../shared/json";
import type { ManualEmitDraft, ResponseDraft, SenderDraft } from "./types";

export function createSenderDraft(sender: BridgeSender): SenderDraft {
  return {
    id: sender.id,
    name: sender.name,
    enabled: sender.enabled,
    matchEvent: sender.matchEvent,
  };
}

export function createResponseDraft(senderId: string, response: BridgeResponseOption): ResponseDraft {
  return {
    senderId,
    id: response.id,
    name: response.name,
    delayMs: String(response.delayMs),
    mode: response.mode,
    eventName: response.eventName,
    detailText: formatJson(response.detail),
  };
}

export function formatResponseDraftJson(draft: ResponseDraft): ResponseDraft {
  const parsed = safeParseJson(draft.detailText);
  if (!parsed.ok) {
    return draft;
  }

  return {
    ...draft,
    detailText: formatJson(parsed.value),
  };
}

export function createManualEmitDraft(): ManualEmitDraft {
  return {
    eventName: "",
    detailText: formatJson({}),
  };
}

export function formatManualEmit(draft: ManualEmitDraft): ManualEmitDraft {
  const parsed = safeParseJson(draft.detailText);
  if (!parsed.ok) {
    return draft;
  }

  return {
    ...draft,
    detailText: formatJson(parsed.value),
  };
}
