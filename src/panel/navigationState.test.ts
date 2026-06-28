import { describe, expect, it } from "vitest";
import { createSnapshot } from "../test/factories";
import { createInitialManualEmitDraft } from "./panelActions";
import {
  buildRulesSubTabRoute,
  buildTabRoute,
  buildSenderDetailRoute,
  createInitialNavigationState,
  navigateBackState,
  pushRouteState,
  replaceRouteState,
  shouldHandleMouseBack,
} from "./navigationState";
import type { AppViewState } from "./types";

function createState(
  overrides: Partial<AppViewState> = {},
): AppViewState {
  return {
    navigation: createInitialNavigationState(),
    snapshot: createSnapshot(),
    selectedSenderId: null,
    senderDraft: null,
    selectedResponse: null,
    responseDraft: null,
    manualEmit: createInitialManualEmitDraft(),
    filterText: "",
    activeLogEvent: null,
    toast: null,
    importStrategy: "merge",
    activeTab: "rules",
    rulesSubTab: "matches",
    narrowDetailOpen: false,
    ...overrides,
  };
}

describe("navigationState", () => {
  it("pushRouteState 会为顶层 tab 记录回退历史", () => {
    const current = createState();

    const next = pushRouteState(current, buildTabRoute(current, "logs"));

    expect(next.activeTab).toBe("logs");
    expect(next.navigation.current).toEqual({ tab: "logs" });
    expect(next.navigation.history).toEqual([{ tab: "rules", rulesSubTab: "matches" }]);
  });

  it("pushRouteState 会为规则子页签记录来源页", () => {
    const current = createState();

    const next = pushRouteState(current, buildRulesSubTabRoute("responses"));

    expect(next.rulesSubTab).toBe("responses");
    expect(next.navigation.current).toEqual({
      tab: "rules",
      rulesSubTab: "responses",
      detail: "list",
    });
    expect(next.navigation.history).toEqual([{ tab: "rules", rulesSubTab: "matches" }]);
  });

  it("replaceRouteState 不会额外追加历史", () => {
    const current = pushRouteState(createState(), buildRulesSubTabRoute("senders"));

    const next = replaceRouteState(current, buildSenderDetailRoute("sender-1"));

    expect(next.navigation.history).toEqual([{ tab: "rules", rulesSubTab: "matches" }]);
  });

  it("navigateBackState 会回到最近历史页", () => {
    const current = pushRouteState(
      pushRouteState(createState(), buildTabRoute(createState(), "logs")),
      buildRulesSubTabRoute("responses"),
    );

    const next = navigateBackState(current);

    expect(next.navigation.current).toEqual({ tab: "logs" });
    expect(next.activeTab).toBe("logs");
  });

  it("shouldHandleMouseBack 会忽略没有历史和可编辑目标", () => {
    expect(
      shouldHandleMouseBack(3, { tagName: "DIV" } as unknown as EventTarget, 1),
    ).toBe(true);
    expect(
      shouldHandleMouseBack(3, { tagName: "INPUT" } as unknown as EventTarget, 1),
    ).toBe(false);
    expect(
      shouldHandleMouseBack(
        3,
        { isContentEditable: true } as unknown as EventTarget,
        1,
      ),
    ).toBe(false);
    expect(
      shouldHandleMouseBack(3, { tagName: "DIV" } as unknown as EventTarget, 0),
    ).toBe(false);
    expect(
      shouldHandleMouseBack(0, { tagName: "DIV" } as unknown as EventTarget, 1),
    ).toBe(false);
  });
});
