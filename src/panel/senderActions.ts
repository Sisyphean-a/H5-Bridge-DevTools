import type { BridgeLogItem } from "../shared/bridgeTypes";
import { createBlankSender, getPresetSenderById } from "../shared/presets";
import { createSenderFromLog, findEquivalentResponseIndex, validateSender } from "../shared/rules";
import type { BridgeSender } from "../shared/senderTypes";
import { createResponseDraft, createSenderDraft } from "./utils";
import { findSender } from "./controllerFilters";
import type { PanelActionContext } from "./actionContext";
import { postCommand, setToast } from "./actionContext";
import type { SenderDraft } from "./types";

export function selectSender(context: PanelActionContext, senderId: string): void {
  const sender = findSender(context.state.snapshot?.senders ?? [], senderId);
  if (!sender) {
    return;
  }
  context.setState((current) => ({
    ...current,
    selectedSenderId: sender.id,
    senderDraft: createSenderDraft(sender),
    narrowDetailOpen: true,
  }));
}

export function openSenderTab(context: PanelActionContext, senderId: string): void {
  selectSender(context, senderId);
  context.setState((current) => ({
    ...current,
    activeTab: "rules",
    rulesSubTab: "senders",
    narrowDetailOpen: true,
  }));
}

export function addBlankSender(context: PanelActionContext): void {
  const sender = createBlankSender();
  postCommand(context, { type: "UPSERT_SENDER", sender });
  hydrateNewSender(context, sender, "senders");
}

export function addPresetSender(context: PanelActionContext, presetId: string): void {
  const sender = getPresetSenderById(presetId);
  if (!sender) {
    return;
  }
  const existing = findSenderByEvent(context.state.snapshot?.senders ?? [], sender.matchEvent);
  if (existing) {
    appendResponsesToExistingSender(context, existing, sender, "senders");
    setToast(context, "success", `已将模板响应追加到“${existing.name}”`);
    return;
  }
  postCommand(context, { type: "UPSERT_SENDER", sender });
  hydrateNewSender(context, sender, "senders");
}

export function saveSender(context: PanelActionContext): void {
  const senders = context.state.snapshot?.senders ?? [];
  const source = findSender(senders, context.state.selectedSenderId);
  const draft = context.state.senderDraft;
  if (!source || !draft) {
    setToast(context, "error", "发送数据尚未同步，稍后再试");
    return;
  }
  const nextSender = buildSenderFromDraft(draft, source);
  const duplicate = findSenderByEvent(senders, nextSender.matchEvent, source.id);
  if (duplicate) {
    setToast(context, "error", `匹配事件“${nextSender.matchEvent}”已存在于发送“${duplicate.name}”`);
    return;
  }
  const errors = validateSender(nextSender);
  if (errors.length > 0) {
    setToast(context, "error", errors[0]);
    return;
  }
  postCommand(context, { type: "UPSERT_SENDER", sender: nextSender });
  setToast(context, "success", "发送已保存");
}

export function deleteSender(context: PanelActionContext): void {
  const senderId = context.state.selectedSenderId;
  if (!senderId) {
    return;
  }
  postCommand(context, { type: "DELETE_SENDER", senderId });
  context.setState((current) => ({
    ...current,
    selectedSenderId: null,
    senderDraft: null,
    selectedResponse: current.selectedResponse?.senderId === senderId ? null : current.selectedResponse,
    responseDraft: current.selectedResponse?.senderId === senderId ? null : current.responseDraft,
    narrowDetailOpen: false,
  }));
}

export function duplicateSender(context: PanelActionContext): void {
  if (!context.state.selectedSenderId) {
    return;
  }
  postCommand(context, {
    type: "DUPLICATE_SENDER",
    senderId: context.state.selectedSenderId,
  });
  setToast(context, "success", "已复制发送");
}

export function resetSender(context: PanelActionContext): void {
  const sender = findSender(context.state.snapshot?.senders ?? [], context.state.selectedSenderId);
  if (!sender) {
    return;
  }
  context.setState((current) => ({
    ...current,
    senderDraft: createSenderDraft(sender),
  }));
}

export function createSenderFromLogEntry(context: PanelActionContext, log: BridgeLogItem): void {
  const sender = createSenderFromLog(log);
  const existing = findSenderByEvent(context.state.snapshot?.senders ?? [], sender.matchEvent);
  if (existing) {
    appendResponsesToExistingSender(context, existing, sender, "responses");
    setToast(context, "success", `已将响应追加到“${existing.name}”`);
    return;
  }
  postCommand(context, { type: "UPSERT_SENDER", sender });
  hydrateNewSender(context, sender, "responses");
}

function hydrateNewSender(
  context: PanelActionContext,
  sender: BridgeSender,
  rulesSubTab: "senders" | "responses",
): void {
  context.setState((current) => ({
    ...current,
    activeTab: "rules",
    rulesSubTab,
    selectedSenderId: sender.id,
    senderDraft: createSenderDraft(sender),
    selectedResponse: sender.responses[0]
      ? { senderId: sender.id, responseId: sender.responses[0].id }
      : null,
    responseDraft: sender.responses[0] ? createResponseDraft(sender.id, sender.responses[0]) : null,
    narrowDetailOpen: true,
  }));
}

function buildSenderFromDraft(draft: SenderDraft, source: BridgeSender): BridgeSender {
  return {
    ...source,
    name: draft.name.trim(),
    enabled: draft.enabled,
    matchEvent: draft.matchEvent.trim(),
    meta: { ...source.meta, updatedAt: Date.now() },
  };
}

function findSenderByEvent(
  senders: BridgeSender[],
  matchEvent: string,
  excludeId?: string,
): BridgeSender | null {
  const normalized = matchEvent.trim();
  if (!normalized) {
    return null;
  }

  return (
    senders.find(
      (sender) => sender.id !== excludeId && sender.matchEvent.trim() === normalized,
    ) ?? null
  );
}

function appendResponsesToExistingSender(
  context: PanelActionContext,
  target: BridgeSender,
  source: BridgeSender,
  rulesSubTab: "senders" | "responses",
): void {
  const appendedResponses = source.responses.filter(
    (response) => findEquivalentResponseIndex(target.responses, response) < 0,
  );

  appendedResponses.forEach((response, index) => {
    postCommand(context, {
      type: "UPSERT_RESPONSE",
      senderId: target.id,
      response,
    });
    if (!target.activeResponseId && index === 0) {
      postCommand(context, {
        type: "SET_ACTIVE_RESPONSE",
        senderId: target.id,
        responseId: response.id,
      });
    }
  });

  const existingFocusResponse =
    source.responses[0] &&
    findEquivalentResponseIndex(target.responses, source.responses[0]) >= 0
      ? target.responses[findEquivalentResponseIndex(target.responses, source.responses[0])]
      : null;
  const focusResponse = appendedResponses[0] ?? existingFocusResponse ?? null;
  const selectedResponse = focusResponse
    ? { senderId: target.id, responseId: focusResponse.id }
    : null;

  context.setState((current) => ({
    ...current,
    activeTab: "rules",
    rulesSubTab,
    selectedSenderId: target.id,
    senderDraft: createSenderDraft(target),
    selectedResponse,
    responseDraft: focusResponse
      ? createResponseDraft(target.id, focusResponse)
      : current.responseDraft,
    narrowDetailOpen: true,
  }));
}
