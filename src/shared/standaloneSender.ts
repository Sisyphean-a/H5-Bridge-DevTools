import type { BridgeResponseOption, BridgeSender } from "./senderTypes";

export const STANDALONE_SENDER_ID = "__android-standalone-emit__";
export const STANDALONE_SENDER_EVENT = "__android-standalone-emit__";
export const STANDALONE_SENDER_NAME = "独立安卓发送";
export const STANDALONE_RESPONSE_OWNER_LABEL = "独立发送";
export const STANDALONE_RESPONSE_TARGET_LABEL = "独立发送（不跟踪 H5 -> 安卓）";

type SenderLike = Pick<BridgeSender, "id"> | null | undefined;

export function isStandaloneSenderId(senderId: string | null | undefined): boolean {
  return senderId === STANDALONE_SENDER_ID;
}

export function isStandaloneSender(sender: SenderLike): boolean {
  return isStandaloneSenderId(sender?.id);
}

export function isVisibleSender(sender: BridgeSender): boolean {
  return !isStandaloneSender(sender);
}

export function createStandaloneSender(
  responses: BridgeResponseOption[] = [],
): BridgeSender {
  const now = Date.now();
  return {
    id: STANDALONE_SENDER_ID,
    name: STANDALONE_SENDER_NAME,
    matchEvent: STANDALONE_SENDER_EVENT,
    responses,
    activeResponseId: null,
    lastActiveResponseId: responses[0]?.id ?? null,
    meta: { createdAt: now, updatedAt: now, hitCount: 0 },
  };
}

export function getResponseOwnerLabel(sender: BridgeSender): string {
  return isStandaloneSender(sender) ? STANDALONE_RESPONSE_OWNER_LABEL : sender.name;
}
