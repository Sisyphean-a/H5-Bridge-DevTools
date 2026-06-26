import type { BridgeLogItem } from "./bridgeTypes";
import { cloneJson } from "./json";
import { createId } from "./id";
import { createBlankSender } from "./presets";
import type { ImportStrategy } from "./ruleTypes";
import type { BridgeResponseOption, BridgeSender } from "./senderTypes";

type LegacyBridgeSender = BridgeSender & { enabled?: boolean };

export function findMatchingSender(
  senders: BridgeSender[],
  eventName: string,
): BridgeSender | undefined {
  return senders.find(
    (sender) => sender.matchEvent === eventName && Boolean(getActiveResponse(sender)),
  );
}

export function getActiveResponse(
  sender: BridgeSender,
): BridgeResponseOption | undefined {
  if (!sender.activeResponseId) {
    return undefined;
  }
  return sender.responses.find((response) => response.id === sender.activeResponseId);
}

function cloneSenderWithNewIds(sender: BridgeSender): BridgeSender {
  const idMap = new Map<string, string>();
  const responses = sender.responses.map((response) => {
    const nextId = createId("resp");
    idMap.set(response.id, nextId);
    return { ...cloneJson(response), id: nextId };
  });

  return {
    ...cloneJson(sender),
    responses,
    activeResponseId: sender.activeResponseId
      ? idMap.get(sender.activeResponseId) ?? null
      : null,
  };
}

export function duplicateSender(sender: BridgeSender): BridgeSender {
  const now = Date.now();
  const cloned = cloneSenderWithNewIds(sender);
  return {
    ...cloned,
    id: createId("sender"),
    name: `${sender.name} 副本`,
    matchEvent: "",
    activeResponseId: cloned.responses[0]?.id ?? null,
    meta: { createdAt: now, updatedAt: now, hitCount: 0 },
  };
}

export function validateSender(sender: BridgeSender): string[] {
  const errors: string[] = [];

  if (!sender.name.trim()) {
    errors.push("发送名称不能为空");
  }
  if (!sender.matchEvent.trim()) {
    errors.push("匹配事件不能为空");
  }

  return errors;
}

export function validateResponse(response: BridgeResponseOption): string[] {
  const errors: string[] = [];

  if (!response.name.trim()) {
    errors.push("响应名称不能为空");
  }
  if (!response.eventName.trim()) {
    errors.push("事件名不能为空");
  }
  if (!Number.isFinite(response.delayMs) || response.delayMs < 0) {
    errors.push("延迟必须是大于等于 0 的数字");
  }

  return errors;
}

export function createSenderFromLog(log: BridgeLogItem): BridgeSender {
  const eventName = log.event ?? "新事件";
  const base = createBlankSender();
  const response: BridgeResponseOption = {
    ...base.responses[0],
    name: "默认响应",
    eventName,
    detail: cloneJson(log.response ?? {}),
  };

  return {
    ...base,
    name: `模拟 ${eventName}`,
    matchEvent: eventName,
    responses: [response],
    activeResponseId: response.id,
  };
}

export function mergeImportedSenders(
  currentSenders: BridgeSender[],
  importedSenders: BridgeSender[],
  strategy: ImportStrategy,
): BridgeSender[] {
  if (strategy === "replace") {
    return normalizeSenders(
      importedSenders.map((sender) => normalizeImportedSender(sender, false)),
    );
  }

  const normalized = importedSenders.map((sender) =>
    normalizeImportedSender(sender, strategy === "appendUnpaired"),
  );

  return normalizeSenders([...currentSenders, ...normalized]);
}

export function normalizeSenders(senders: BridgeSender[]): BridgeSender[] {
  const merged: BridgeSender[] = [];
  const indexByEvent = new Map<string, number>();

  for (const sender of senders) {
    const normalized = normalizeSenderShape(sender);
    const key = normalized.matchEvent.trim();
    if (!key) {
      merged.push(normalized);
      continue;
    }

    const existingIndex = indexByEvent.get(key);
    if (existingIndex === undefined) {
      indexByEvent.set(key, merged.length);
      merged.push(normalized);
      continue;
    }

    merged[existingIndex] = mergeSenderPair(merged[existingIndex], normalized);
  }

  return merged;
}

export function findEquivalentResponseIndex(
  responses: BridgeResponseOption[],
  target: BridgeResponseOption,
): number {
  const directIndex = responses.findIndex((response) => response.id === target.id);
  if (directIndex >= 0) {
    return directIndex;
  }

  const targetSignature = createResponseSignature(target);
  return responses.findIndex((response) => createResponseSignature(response) === targetSignature);
}

function normalizeImportedSender(
  sender: BridgeSender,
  clearActiveResponse: boolean,
): BridgeSender {
  const now = Date.now();
  const cloned = normalizeSenderShape(cloneSenderWithNewIds(sender));
  return {
    ...cloned,
    id: createId("sender"),
    activeResponseId: clearActiveResponse ? null : cloned.activeResponseId,
    meta: { createdAt: now, updatedAt: now, hitCount: 0 },
  };
}

function normalizeSenderShape(sender: BridgeSender): BridgeSender {
  const cloned = cloneJson(sender) as LegacyBridgeSender;
  const responses = dedupeResponsesByIdentity(cloned.responses ?? []);
  const legacyEnabled = cloned.enabled ?? true;
  const activeResponseId =
    legacyEnabled &&
    cloned.activeResponseId &&
    responses.some((response) => response.id === cloned.activeResponseId)
      ? cloned.activeResponseId
      : null;

  return {
    id: cloned.id,
    name: cloned.name.trim(),
    matchEvent: cloned.matchEvent.trim(),
    responses,
    activeResponseId,
    meta: cloned.meta,
  };
}

function dedupeResponsesByIdentity(
  responses: BridgeResponseOption[],
): BridgeResponseOption[] {
  const seenIds = new Set<string>();
  const seenSignatures = new Set<string>();
  const normalized: BridgeResponseOption[] = [];

  for (const response of responses) {
    const cloned = cloneJson(response);
    if (!cloned.id || seenIds.has(cloned.id)) {
      cloned.id = createId("resp");
    }
    const signature = createResponseSignature(cloned);
    if (seenSignatures.has(signature)) {
      continue;
    }
    seenIds.add(cloned.id);
    seenSignatures.add(signature);
    normalized.push(cloned);
  }

  return normalized;
}

function mergeSenderPair(base: BridgeSender, incoming: BridgeSender): BridgeSender {
  const responses = dedupeResponsesByIdentity([...base.responses, ...incoming.responses]);
  return {
    ...base,
    name: mergeSenderName(base, incoming),
    responses,
    activeResponseId: pickActiveResponseId(base, incoming, responses),
    meta: {
      createdAt: pickCreatedAt(base.meta?.createdAt, incoming.meta?.createdAt),
      updatedAt: Math.max(base.meta?.updatedAt ?? 0, incoming.meta?.updatedAt ?? 0) || undefined,
      hitCount: (base.meta?.hitCount ?? 0) + (incoming.meta?.hitCount ?? 0),
    },
  };
}

function mergeSenderName(base: BridgeSender, incoming: BridgeSender): string {
  const commonPrefix = trimSenderPrefix(findCommonPrefix([base.name, incoming.name]));
  if (commonPrefix.length >= 2) {
    return commonPrefix;
  }
  return base.name || incoming.name || base.matchEvent || incoming.matchEvent;
}

function findCommonPrefix(values: string[]): string {
  const [first, ...rest] = values.map((value) => value.trim()).filter(Boolean);
  if (!first) {
    return "";
  }

  let prefix = first;
  for (const value of rest) {
    while (prefix && !value.startsWith(prefix)) {
      prefix = prefix.slice(0, -1);
    }
    if (!prefix) {
      return "";
    }
  }
  return prefix;
}

function trimSenderPrefix(value: string): string {
  return value.replace(/[\s:/_|-]+$/u, "").trim();
}

function pickActiveResponseId(
  base: BridgeSender,
  incoming: BridgeSender,
  responses: BridgeResponseOption[],
): string | null {
  const responseIds = new Set(responses.map((response) => response.id));
  const candidates = [
    base.activeResponseId,
    incoming.activeResponseId,
    responses[0]?.id ?? null,
  ];

  for (const candidate of candidates) {
    if (candidate && responseIds.has(candidate)) {
      return candidate;
    }
  }
  return null;
}

function pickCreatedAt(
  left?: number,
  right?: number,
): number | undefined {
  if (left === undefined) {
    return right;
  }
  if (right === undefined) {
    return left;
  }
  return Math.min(left, right);
}

function createResponseSignature(response: BridgeResponseOption): string {
  return JSON.stringify([
    response.name.trim(),
    response.delayMs,
    response.mode,
    response.eventName.trim(),
    response.detail,
  ]);
}
