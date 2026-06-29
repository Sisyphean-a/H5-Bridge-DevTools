import { createBlankResponse } from "../shared/presets";
import { safeParseJson } from "../shared/json";
import { validateResponse } from "../shared/rules";
import type { BridgeResponseOption } from "../shared/senderTypes";
import {
  createStandaloneSender,
  isStandaloneSender,
  isStandaloneSenderId,
} from "../shared/standaloneSender";
import {
  buildResponseDetailRoute,
  pushRouteState,
  buildRulesSubTabRoute,
  removeResponseFromNavigation,
  replaceRouteState,
  shouldReplaceDetailRoute,
} from "./navigationState";
import { createResponseDraft, formatResponseDraftJson } from "./utils";
import { findResponseRecord, findSender } from "./controllerFilters";
import type { PanelActionContext } from "./actionContext";
import { postCommand, setToast } from "./actionContext";
import { openResponseState } from "./selectionState";
import type { AppViewState, ResponseDraft } from "./types";

export function selectResponse(
  context: PanelActionContext,
  senderId: string,
  responseId: string,
  rulesSubTab: AppViewState["rulesSubTab"] = "responses",
): void {
  const record = findResponseRecord(context.state.snapshot?.senders ?? [], { senderId, responseId });
  if (!record) {
    return;
  }
  context.setState((current) => {
    const next = openResponseState(current, record.sender, record.response, rulesSubTab);
    const route = buildResponseDetailRoute(record.sender.id, record.response.id);
    return shouldReplaceDetailRoute(current, route)
      ? replaceRouteState(next, route)
      : pushRouteState(next, route);
  });
}

export function createResponseForSender(context: PanelActionContext, senderId: string): void {
  const sender = findSender(context.state.snapshot?.senders ?? [], senderId);
  if (!sender && !isStandaloneSenderId(senderId)) {
    setToast(context, "error", "请先选择一个发送");
    return;
  }
  const response = createBlankResponse();
  const targetSender = sender ?? createStandaloneSender([response]);
  if (sender) {
    postCommand(context, { type: "UPSERT_RESPONSE", senderId, response });
  } else {
    postCommand(context, { type: "UPSERT_SENDER", sender: targetSender });
  }
  if (
    sender &&
    !isStandaloneSender(sender) &&
    (sender.responses.length === 0 || !sender.activeResponseId)
  ) {
    postCommand(context, { type: "SET_ACTIVE_RESPONSE", senderId, responseId: response.id });
  }
  context.setState((current) => {
    const next = openResponseState(current, targetSender, response);
    const route = buildResponseDetailRoute(targetSender.id, response.id);
    return shouldReplaceDetailRoute(current, route)
      ? replaceRouteState(next, route)
      : pushRouteState(next, route);
  });
}

export function saveResponse(context: PanelActionContext): void {
  const record = findResponseRecord(context.state.snapshot?.senders ?? [], context.state.selectedResponse);
  const draft = context.state.responseDraft;
  if (!record || !draft) {
    setToast(context, "error", "响应数据尚未同步，稍后再试");
    return;
  }
  const result = buildResponseFromDraft(draft, record.response);
  if (!result.ok) {
    setToast(context, "error", result.error);
    return;
  }
  const errors = validateResponse(result.response);
  if (errors.length > 0) {
    setToast(context, "error", errors[0]);
    return;
  }
  postCommand(context, {
    type: "UPSERT_RESPONSE",
    senderId: record.sender.id,
    response: result.response,
  });
  setToast(context, "success", "响应已保存");
}

export function deleteResponse(context: PanelActionContext): void {
  const record = findResponseRecord(context.state.snapshot?.senders ?? [], context.state.selectedResponse);
  if (!record) {
    return;
  }
  const nextResponse = record.sender.responses.find((item) => item.id !== record.response.id) ?? null;
  postCommand(context, {
    type: "DELETE_RESPONSE",
    senderId: record.sender.id,
    responseId: record.response.id,
  });
  if (record.isStandalone && !nextResponse) {
    postCommand(context, {
      type: "DELETE_SENDER",
      senderId: record.sender.id,
    });
  }
  context.setState((current) => {
    const next = {
      ...current,
      selectedResponse: nextResponse
        ? { senderId: record.sender.id, responseId: nextResponse.id }
        : null,
      responseDraft: nextResponse ? createResponseDraft(record.sender.id, nextResponse) : null,
      narrowDetailOpen: Boolean(nextResponse),
    };
    return removeResponseFromNavigation(
      next,
      record.sender.id,
      record.response.id,
      nextResponse
        ? buildResponseDetailRoute(record.sender.id, nextResponse.id)
        : buildRulesSubTabRoute("responses"),
    );
  });
}

export function resetResponse(context: PanelActionContext): void {
  const record = findResponseRecord(context.state.snapshot?.senders ?? [], context.state.selectedResponse);
  if (!record) {
    return;
  }
  context.setState((current) => ({
    ...current,
    responseDraft: createResponseDraft(record.sender.id, record.response),
  }));
}

export function formatCurrentResponseJson(context: PanelActionContext): void {
  if (!context.state.responseDraft) {
    return;
  }
  context.setState((current) => ({
    ...current,
    responseDraft: current.responseDraft ? formatResponseDraftJson(current.responseDraft) : null,
  }));
}

export function triggerSelectedResponse(context: PanelActionContext): void {
  const ref = context.state.selectedResponse;
  if (!ref) {
    return;
  }
  postCommand(context, {
    type: "TRIGGER_RESPONSE",
    senderId: ref.senderId,
    responseId: ref.responseId,
  });
  setToast(context, "success", "已触发测试");
}

export function setActiveResponse(
  context: PanelActionContext,
  senderId: string,
  responseId: string | null,
): void {
  postCommand(context, { type: "SET_ACTIVE_RESPONSE", senderId, responseId });
}

function buildResponseFromDraft(
  draft: ResponseDraft,
  source: BridgeResponseOption,
): { ok: true; response: BridgeResponseOption } | { ok: false; error: string } {
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
    response: {
      ...source,
      name: draft.name.trim(),
      delayMs,
      mode: draft.mode,
      eventName: draft.eventName.trim(),
      detail: parsedDetail.value,
      meta: { ...source.meta, updatedAt: Date.now() },
    },
  };
}
