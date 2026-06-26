import { cloneJson } from "../shared/json";
import {
  duplicateSender,
  findEquivalentResponseIndex,
  mergeImportedSenders,
  normalizeSenders,
} from "../shared/rules";
import type { ImportStrategy } from "../shared/ruleTypes";
import type { BridgeResponseOption, BridgeSender } from "../shared/senderTypes";

export function upsertSenderState(
  senders: BridgeSender[],
  sender: BridgeSender,
  now = Date.now(),
): BridgeSender[] {
  const nextSender: BridgeSender = {
    ...cloneJson(sender),
    meta: {
      ...sender.meta,
      createdAt: sender.meta?.createdAt ?? now,
      updatedAt: now,
      hitCount: sender.meta?.hitCount ?? 0,
    },
  };
  const index = senders.findIndex((item) => item.id === sender.id);
  const nextSenders =
    index >= 0
      ? senders.map((item, itemIndex) => (itemIndex === index ? nextSender : item))
      : [...senders, nextSender];
  return normalizeSenders(nextSenders);
}

export function deleteSenderState(
  senders: BridgeSender[],
  senderId: string,
): BridgeSender[] {
  return normalizeSenders(senders.filter((sender) => sender.id !== senderId));
}

export function duplicateSenderState(
  senders: BridgeSender[],
  senderId: string,
): BridgeSender[] {
  const source = senders.find((sender) => sender.id === senderId);
  return source ? normalizeSenders([...senders, duplicateSender(source)]) : senders;
}

export function setActiveResponseState(
  senders: BridgeSender[],
  senderId: string,
  responseId: string | null,
  now = Date.now(),
): BridgeSender[] {
  return normalizeSenders(
    senders.map((sender) => {
      if (sender.id !== senderId) {
        return sender;
      }
      const nextActiveId =
        responseId === null
          ? null
          : sender.responses.some((response) => response.id === responseId)
            ? responseId
            : sender.activeResponseId;
      return {
        ...sender,
        activeResponseId: nextActiveId,
        meta: { ...sender.meta, updatedAt: now },
      };
    }),
  );
}

export function upsertResponseState(
  senders: BridgeSender[],
  senderId: string,
  response: BridgeResponseOption,
  now = Date.now(),
): BridgeSender[] {
  return normalizeSenders(
    senders.map((sender) => {
      if (sender.id !== senderId) {
        return sender;
      }
      const nextResponse: BridgeResponseOption = {
        ...cloneJson(response),
        meta: {
          ...response.meta,
          createdAt: response.meta?.createdAt ?? now,
          updatedAt: now,
          hitCount: response.meta?.hitCount ?? 0,
        },
      };
      const index = findEquivalentResponseIndex(sender.responses, nextResponse);
      const wasEmpty = sender.responses.length === 0;
      const responses =
        index >= 0
          ? sender.responses.map((item, itemIndex) =>
              itemIndex === index ? nextResponse : item,
            )
          : [...sender.responses, nextResponse];
      return {
        ...sender,
        responses,
        activeResponseId: index < 0 && wasEmpty ? nextResponse.id : sender.activeResponseId,
      };
    }),
  );
}

export function deleteResponseState(
  senders: BridgeSender[],
  senderId: string,
  responseId: string,
): BridgeSender[] {
  return normalizeSenders(
    senders.map((sender) => {
      if (sender.id !== senderId) {
        return sender;
      }
      const responses = sender.responses.filter((item) => item.id !== responseId);
      return {
        ...sender,
        responses,
        activeResponseId:
          sender.activeResponseId === responseId
            ? (responses[0]?.id ?? null)
            : sender.activeResponseId,
      };
    }),
  );
}

export function importSendersState(
  senders: BridgeSender[],
  importedSenders: BridgeSender[],
  strategy: ImportStrategy,
): BridgeSender[] {
  return mergeImportedSenders(senders, importedSenders, strategy);
}

export function updateHitCountState(
  senders: BridgeSender[],
  senderId: string,
  responseId: string,
  now = Date.now(),
): BridgeSender[] {
  return normalizeSenders(
    senders.map((sender) =>
      sender.id === senderId
        ? {
            ...sender,
            responses: sender.responses.map((response) =>
              response.id === responseId
                ? {
                    ...response,
                    meta: {
                      ...response.meta,
                      updatedAt: now,
                      hitCount: (response.meta?.hitCount ?? 0) + 1,
                    },
                  }
                : response,
            ),
            meta: {
              ...sender.meta,
              updatedAt: now,
              hitCount: (sender.meta?.hitCount ?? 0) + 1,
            },
          }
        : sender,
    ),
  );
}
