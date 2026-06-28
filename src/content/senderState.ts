import { cloneJson } from "../shared/json";
import {
  duplicateSender,
  findEquivalentResponseIndex,
  mergeImportedSenders,
  normalizeResponseSelection,
  normalizeSenders,
  selectSenderResponse,
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
      return {
        ...sender,
        ...selectSenderResponse(sender, responseId),
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
      const nextSelection =
        index < 0 && wasEmpty
          ? normalizeResponseSelection(responses, nextResponse.id, nextResponse.id)
          : normalizeResponseSelection(
              responses,
              sender.activeResponseId,
              sender.lastActiveResponseId,
            );
      return {
        ...sender,
        responses,
        ...nextSelection,
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
      const fallbackResponseId =
        sender.activeResponseId === responseId || sender.lastActiveResponseId === responseId
          ? (responses[0]?.id ?? null)
          : null;
      return {
        ...sender,
        responses,
        ...normalizeResponseSelection(
          responses,
          sender.activeResponseId === responseId ? fallbackResponseId : sender.activeResponseId,
          sender.lastActiveResponseId === responseId ? null : sender.lastActiveResponseId,
          fallbackResponseId,
        ),
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
