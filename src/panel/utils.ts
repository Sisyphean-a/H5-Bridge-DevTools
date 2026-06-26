import type { BridgeMockRule } from "../shared/ruleTypes";
import type { BridgeSender, BridgeResponseOption } from "../shared/senderTypes";
import { formatJson, safeParseJson } from "../shared/json";
import type { ManualEmitDraft, RuleDraft, SenderDraft, ResponseDraft } from "./types";

export function createRuleDraft(rule: BridgeMockRule): RuleDraft {
  return {
    id: rule.id,
    name: rule.name,
    enabled: rule.enabled,
    matchEvent: rule.match.event,
    delayMs: String(rule.response.delayMs),
    mode: rule.response.mode,
    eventName: rule.response.eventName,
    detailText: formatJson(rule.response.detail),
  };
}

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
    delayMs: response.delayMs,
    mode: response.mode,
    eventName: response.eventName,
    detailText: formatJson(response.detail),
  };
}

export function createRuleFromDraft(draft: RuleDraft, source: BridgeMockRule): {
  ok: true;
  rule: BridgeMockRule;
} | {
  ok: false;
  error: string;
} {
  const parsedDetail = safeParseJson(draft.detailText);
  if (!parsedDetail.ok) {
    return { ok: false, error: `Detail JSON 无效: ${parsedDetail.error}` };
  }

  const delayMs = Number(draft.delayMs);
  if (!Number.isFinite(delayMs) || delayMs < 0) {
    return { ok: false, error: "Delay 必须是大于等于 0 的数字" };
  }

  return {
    ok: true,
    rule: {
      ...source,
      id: draft.id,
      name: draft.name.trim(),
      enabled: draft.enabled,
      match: {
        event: draft.matchEvent.trim(),
      },
      response: {
        delayMs,
        mode: draft.mode,
        eventName: draft.eventName.trim(),
        detail: parsedDetail.value,
      },
      meta: {
        ...source.meta,
        updatedAt: Date.now(),
      },
    },
  };
}

export function formatDraftJson(draft: RuleDraft): RuleDraft {
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
