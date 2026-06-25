import type { BridgePanelSnapshot } from "../shared/bridgeTypes";
import type { BridgeMockRule } from "../shared/ruleTypes";
import type { AppViewState } from "./types";
import { createRuleDraft } from "./utils";

export function syncSnapshotState(
  current: AppViewState,
  snapshot: BridgePanelSnapshot,
): AppViewState {
  const selectedRule =
    snapshot.rules.find((rule) => rule.id === current.selectedRuleId) ??
    snapshot.rules[0] ??
    null;
  const hasUnsavedNewRule =
    current.ruleDraft &&
    !snapshot.rules.some((rule) => rule.id === current.ruleDraft?.id);
  const shouldPreserveDraft =
    Boolean(current.ruleDraft) &&
    Boolean(selectedRule) &&
    current.ruleDraft?.id === selectedRule?.id &&
    !isDraftInSyncWithRule(current.ruleDraft, selectedRule);

  return {
    ...current,
    snapshot,
    selectedRuleId: hasUnsavedNewRule
      ? current.ruleDraft?.id ?? null
      : selectedRule?.id ?? null,
    ruleDraft: hasUnsavedNewRule || shouldPreserveDraft
      ? current.ruleDraft
      : selectedRule
        ? createRuleDraft(selectedRule)
        : null,
  };
}

function isDraftInSyncWithRule(
  draft: NonNullable<AppViewState["ruleDraft"]>,
  rule: BridgeMockRule,
): boolean {
  const nextDraft = createRuleDraft(rule);
  return (
    draft.id === nextDraft.id &&
    draft.name === nextDraft.name &&
    draft.enabled === nextDraft.enabled &&
    draft.matchEvent === nextDraft.matchEvent &&
    draft.delayMs === nextDraft.delayMs &&
    draft.mode === nextDraft.mode &&
    draft.eventName === nextDraft.eventName &&
    draft.detailText === nextDraft.detailText
  );
}

export function extractRulesFromImport(value: unknown): BridgeMockRule[] | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const maybeRules = Reflect.get(value, "rules");
  return Array.isArray(maybeRules) ? (maybeRules as BridgeMockRule[]) : null;
}

export function requestSnapshot(port: chrome.runtime.Port, tabId: number): void {
  port.postMessage({
    type: "PANEL_COMMAND",
    tabId,
    command: { type: "REQUEST_SNAPSHOT" },
  });
}
