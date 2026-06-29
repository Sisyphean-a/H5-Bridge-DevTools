import type { BridgeLogItem } from "../shared/bridgeTypes";
import type { BridgeResponseOption, BridgeSender } from "../shared/senderTypes";
import {
  getResponseOwnerLabel,
  isStandaloneSender,
  isVisibleSender,
} from "../shared/standaloneSender";
import type { SelectedResponseRef } from "./types";

export interface ResponseRecord {
  sender: BridgeSender;
  response: BridgeResponseOption;
  isActive: boolean;
  isStandalone: boolean;
  ownerLabel: string;
}

export function filterLogs(logs: BridgeLogItem[], activeEvent: string | null): BridgeLogItem[] {
  if (!activeEvent) {
    return logs;
  }
  return logs.filter((log) => log.event === activeEvent);
}

export function filterSenders(senders: BridgeSender[], keyword: string): BridgeSender[] {
  const visibleSenders = senders.filter(isVisibleSender);
  const normalized = keyword.trim().toLowerCase();
  if (!normalized) {
    return visibleSenders;
  }
  return visibleSenders.filter((sender) => matchesSender(sender, normalized));
}

export function filterResponseRecords(senders: BridgeSender[], keyword: string): ResponseRecord[] {
  const records = flattenResponses(senders);
  const normalized = keyword.trim().toLowerCase();
  if (!normalized) {
    return records;
  }
  return records.filter((record) => matchesResponse(record, normalized));
}

export function filterMatchSenders(senders: BridgeSender[], keyword: string): BridgeSender[] {
  const visibleSenders = senders.filter(isVisibleSender);
  const normalized = keyword.trim().toLowerCase();
  if (!normalized) {
    return visibleSenders;
  }
  return visibleSenders.filter((sender) => {
    if (matchesSender(sender, normalized)) {
      return true;
    }
    return sender.responses.some((response) => matchesResponseText(response, normalized));
  });
}

export function countResponses(senders: BridgeSender[]): number {
  return senders.reduce((total, sender) => total + sender.responses.length, 0);
}

export function countPairedSenders(senders: BridgeSender[]): number {
  return senders.filter((sender) => isVisibleSender(sender) && Boolean(sender.activeResponseId)).length;
}

export function findSender(senders: BridgeSender[], senderId: string | null): BridgeSender | null {
  if (!senderId) {
    return null;
  }
  return senders.find((sender) => sender.id === senderId) ?? null;
}

export function findResponseRecord(
  senders: BridgeSender[],
  ref: SelectedResponseRef | null,
): ResponseRecord | null {
  if (!ref) {
    return null;
  }
  const sender = findSender(senders, ref.senderId);
  const response = sender?.responses.find((item) => item.id === ref.responseId) ?? null;
  if (!sender || !response) {
    return null;
  }
  return {
    sender,
    response,
    isActive: sender.activeResponseId === response.id,
    isStandalone: isStandaloneSender(sender),
    ownerLabel: getResponseOwnerLabel(sender),
  };
}

function flattenResponses(senders: BridgeSender[]): ResponseRecord[] {
  return senders.flatMap((sender) =>
    sender.responses.map((response) => ({
      sender,
      response,
      isActive: sender.activeResponseId === response.id,
      isStandalone: isStandaloneSender(sender),
      ownerLabel: getResponseOwnerLabel(sender),
    })),
  );
}

function matchesSender(sender: BridgeSender, keyword: string): boolean {
  return (
    sender.name.toLowerCase().includes(keyword) ||
    sender.matchEvent.toLowerCase().includes(keyword)
  );
}

function matchesResponse(record: ResponseRecord, keyword: string): boolean {
  return (
    record.ownerLabel.toLowerCase().includes(keyword) ||
    record.sender.name.toLowerCase().includes(keyword) ||
    record.sender.matchEvent.toLowerCase().includes(keyword) ||
    matchesResponseText(record.response, keyword)
  );
}

function matchesResponseText(response: BridgeResponseOption, keyword: string): boolean {
  return (
    response.name.toLowerCase().includes(keyword) ||
    response.eventName.toLowerCase().includes(keyword)
  );
}
