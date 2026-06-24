import type { BridgeLogItem } from "./bridgeTypes";
import { cloneJson } from "./json";
import { createId } from "./id";
import { createBlankRule } from "./presets";
import type { BridgeMockRule, ImportStrategy } from "./ruleTypes";

export function findMatchingRule(
  rules: BridgeMockRule[],
  eventName: string,
): BridgeMockRule | undefined {
  return rules.find((rule) => rule.enabled && rule.match.event === eventName);
}

export function duplicateRule(rule: BridgeMockRule): BridgeMockRule {
  const now = Date.now();
  return {
    ...cloneJson(rule),
    id: createId("rule"),
    name: `${rule.name} 副本`,
    meta: {
      createdAt: now,
      updatedAt: now,
      hitCount: 0,
    },
  };
}

export function validateRule(rule: BridgeMockRule): string[] {
  const errors: string[] = [];

  if (!rule.name.trim()) {
    errors.push("规则名称不能为空");
  }
  if (!rule.match.event.trim()) {
    errors.push("匹配事件不能为空");
  }
  if (!rule.response.eventName.trim()) {
    errors.push("事件名不能为空");
  }
  if (!Number.isFinite(rule.response.delayMs) || rule.response.delayMs < 0) {
    errors.push("延迟必须是大于等于 0 的数字");
  }

  return errors;
}

export function createRuleFromLog(log: BridgeLogItem): BridgeMockRule {
  const base = createBlankRule();
  const eventName = log.event ?? "新事件";
  return {
    ...base,
    name: `模拟 ${eventName}`,
    match: { event: eventName },
    response: {
      ...base.response,
      eventName,
      detail: cloneJson(log.response ?? {}),
    },
  };
}

export function mergeImportedRules(
  currentRules: BridgeMockRule[],
  importedRules: BridgeMockRule[],
  strategy: ImportStrategy,
): BridgeMockRule[] {
  if (strategy === "replace") {
    return importedRules.map((rule) => normalizeImportedRule(rule, false));
  }

  const normalized = importedRules.map((rule) =>
    normalizeImportedRule(rule, strategy === "appendDisabled"),
  );

  return [...currentRules, ...normalized];
}

function normalizeImportedRule(
  rule: BridgeMockRule,
  forceDisabled: boolean,
): BridgeMockRule {
  const now = Date.now();
  return {
    ...cloneJson(rule),
    id: createId("rule"),
    enabled: forceDisabled ? false : rule.enabled,
    meta: {
      createdAt: now,
      updatedAt: now,
      hitCount: 0,
    },
  };
}
