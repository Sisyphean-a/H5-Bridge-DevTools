import { normalizeBridgeProfile, type BridgeProfile } from "./bridgeProfiles";
import { createId } from "./id";
import { MAX_RESPONSE_DELAY_MS } from "./rules";
import type { OriginBridgeSettings } from "./ruleTypes";
import type { BridgeResponseOption, BridgeSender } from "./senderTypes";

export interface RulePackage {
  version: 1;
  name: string;
  profile: BridgeProfile;
  settings?: Partial<OriginBridgeSettings>;
  senders: BridgeSender[];
}

export function parseRulePackage(value: unknown):
  | { ok: true; value: RulePackage }
  | { ok: false; error: string } {
  if (!isRecord(value)) {
    return { ok: false, error: "规则包必须是对象" };
  }
  if (value.version !== 1) {
    return { ok: false, error: "仅支持 version: 1 的规则包" };
  }
  if (typeof value.name !== "string" || !value.name.trim()) {
    return { ok: false, error: "规则包缺少 name" };
  }
  const profile = normalizeBridgeProfile(value.profile);
  if (!profile) {
    return { ok: false, error: "profile 必须包含合法的 id、title、hostObject 和 requestEventField" };
  }
  if (!Array.isArray(value.senders)) {
    return { ok: false, error: "规则包缺少 senders 数组" };
  }

  const settings = parseSettings(value.settings);
  if (!settings.ok) {
    return settings;
  }
  const senders = parseSenders(value.senders);
  if (!senders.ok) {
    return senders;
  }

  return {
    ok: true,
    value: {
      version: 1,
      name: value.name.trim(),
      profile,
      ...(Object.keys(settings.value).length > 0 ? { settings: settings.value } : {}),
      senders: senders.value,
    },
  };
}

function parseSettings(value: unknown):
  | { ok: true; value: Partial<OriginBridgeSettings> }
  | { ok: false; error: string } {
  if (value === undefined) {
    return { ok: true, value: {} };
  }
  if (!isRecord(value)) {
    return { ok: false, error: "settings 必须是对象" };
  }

  const settings: Partial<OriginBridgeSettings> = {};
  for (const key of ["autoMock", "preserveLogs", "overrideExistingBridge"] as const) {
    if (value[key] !== undefined) {
      if (typeof value[key] !== "boolean") {
        return { ok: false, error: `settings.${key} 必须是布尔值` };
      }
      settings[key] = value[key];
    }
  }
  const maxLogCount = value.maxLogCount;
  if (maxLogCount !== undefined) {
    if (typeof maxLogCount !== "number" || !Number.isInteger(maxLogCount) || maxLogCount < 1) {
      return { ok: false, error: "settings.maxLogCount 必须是大于 0 的整数" };
    }
    settings.maxLogCount = maxLogCount;
  }
  return { ok: true, value: settings };
}

function parseSenders(value: unknown[]):
  | { ok: true; value: BridgeSender[] }
  | { ok: false; error: string } {
  const senderIds = new Set<string>();
  const responseIds = new Set<string>();
  const senders: BridgeSender[] = [];

  for (let index = 0; index < value.length; index += 1) {
    const sender = value[index];
    if (!isRecord(sender) || !isText(sender.name) || !isText(sender.matchEvent)) {
      return { ok: false, error: `senders[${index}] 必须包含 name 和 matchEvent` };
    }
    if (!Array.isArray(sender.responses)) {
      return { ok: false, error: `senders[${index}].responses 必须是数组` };
    }

    const responses: BridgeResponseOption[] = [];
    for (let responseIndex = 0; responseIndex < sender.responses.length; responseIndex += 1) {
      const response = sender.responses[responseIndex];
      if (
        !isRecord(response) ||
        !isText(response.name) ||
        !isText(response.eventName) ||
        typeof response.delayMs !== "number" ||
        !Number.isFinite(response.delayMs) ||
        response.delayMs < 0 ||
        response.delayMs > MAX_RESPONSE_DELAY_MS
      ) {
        return {
          ok: false,
          error: `senders[${index}].responses[${responseIndex}] 必须包含 name、0 到 24 小时之间的 delayMs 和 eventName`,
        };
      }
      if (response.mode !== undefined && response.mode !== "dispatchEvent") {
        return { ok: false, error: `senders[${index}].responses[${responseIndex}].mode 不受支持` };
      }
      const detail = response.detail ?? null;
      if (!isJsonSerializable(detail)) {
        return {
          ok: false,
          error: `senders[${index}].responses[${responseIndex}].detail 必须可序列化为 JSON`,
        };
      }
      const id = uniqueId(response.id, "resp", responseIds);
      responses.push({
        id,
        name: response.name.trim(),
        delayMs: response.delayMs,
        mode: "dispatchEvent",
        eventName: response.eventName.trim(),
        detail,
      });
    }

    const id = uniqueId(sender.id, "sender", senderIds);
    const requestedActiveId =
      typeof sender.activeResponseId === "string" ? sender.activeResponseId : responses[0]?.id ?? null;
    const activeResponseId = responses.some((response) => response.id === requestedActiveId)
      ? requestedActiveId
      : responses[0]?.id ?? null;
    const requestedLastActiveId =
      typeof sender.lastActiveResponseId === "string" ? sender.lastActiveResponseId : activeResponseId;
    senders.push({
      id,
      name: sender.name.trim(),
      matchEvent: sender.matchEvent.trim(),
      responses,
      activeResponseId,
      lastActiveResponseId: responses.some((response) => response.id === requestedLastActiveId)
        ? requestedLastActiveId
        : activeResponseId,
    });
  }

  return { ok: true, value: senders };
}

function uniqueId(value: unknown, prefix: string, used: Set<string>): string {
  if (typeof value === "string" && value.trim() && !used.has(value)) {
    used.add(value);
    return value;
  }
  let id = createId(prefix);
  while (used.has(id)) {
    id = createId(prefix);
  }
  used.add(id);
  return id;
}

function isJsonSerializable(value: unknown): boolean {
  try {
    return typeof JSON.stringify(value) === "string";
  } catch {
    return false;
  }
}

function isText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
