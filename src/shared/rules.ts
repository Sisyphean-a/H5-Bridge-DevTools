import type { BridgeLogItem } from "./bridgeTypes";
import { cloneJson } from "./json";
import { createId } from "./id";
import { createBlankSender } from "./presets";
import type { ImportStrategy } from "./ruleTypes";
import type { BridgeResponseOption, BridgeSender } from "./senderTypes";

export function findMatchingSender(
  senders: BridgeSender[],
  eventName: string,
): BridgeSender | undefined {
  return senders.find((sender) => sender.enabled && sender.matchEvent === eventName);
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
    return importedSenders.map((sender) => normalizeImportedSender(sender, false));
  }

  const normalized = importedSenders.map((sender) =>
    normalizeImportedSender(sender, strategy === "appendDisabled"),
  );

  return [...currentSenders, ...normalized];
}

function normalizeImportedSender(
  sender: BridgeSender,
  forceDisabled: boolean,
): BridgeSender {
  const now = Date.now();
  const cloned = cloneSenderWithNewIds(sender);
  return {
    ...cloned,
    id: createId("sender"),
    enabled: forceDisabled ? false : sender.enabled,
    meta: { createdAt: now, updatedAt: now, hitCount: 0 },
  };
}
