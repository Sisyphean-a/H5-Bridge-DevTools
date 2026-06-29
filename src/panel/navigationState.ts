import type { BridgePanelSnapshot } from "../shared/bridgeTypes";
import { findResponseRecord, findSender } from "./controllerFilters";
import { openResponseState, openSenderState } from "./selectionState";
import type { AppViewState, PanelRoute, PanelTabId, RulesSubTab } from "./types";

export const initialPanelRoute: PanelRoute = { tab: "rules", rulesSubTab: "matches" };

const senderListRoute: PanelRoute = {
  tab: "rules",
  rulesSubTab: "senders",
  detail: "list",
};
const responsesListRoute: PanelRoute = {
  tab: "rules",
  rulesSubTab: "responses",
  detail: "list",
};

export function createInitialNavigationState(): AppViewState["navigation"] {
  return {
    current: initialPanelRoute,
    history: [],
  };
}

export function buildTabRoute(current: AppViewState, tab: PanelTabId): PanelRoute {
  if (tab !== "rules") {
    return { tab };
  }
  if (current.navigation.current.tab === "rules") {
    return current.navigation.current;
  }

  const previousRulesRoute = [...current.navigation.history]
    .reverse()
    .find((route) => route.tab === "rules");
  return previousRulesRoute ?? initialPanelRoute;
}

export function buildRulesSubTabRoute(rulesSubTab: RulesSubTab): PanelRoute {
  if (rulesSubTab === "matches") {
    return { tab: "rules", rulesSubTab: "matches" };
  }

  return {
    tab: "rules",
    rulesSubTab,
    detail: "list",
  };
}

export function buildSenderDetailRoute(senderId: string): PanelRoute {
  return {
    tab: "rules",
    rulesSubTab: "senders",
    detail: "detail",
    senderId,
  };
}

export function buildResponseDetailRoute(
  senderId: string,
  responseId: string,
): PanelRoute {
  return {
    tab: "rules",
    rulesSubTab: "responses",
    detail: "detail",
    senderId,
    responseId,
  };
}

export function replaceRouteState(
  current: AppViewState,
  route: PanelRoute,
): AppViewState {
  return applyNavigation(current, {
    current: normalizeRoute(current.snapshot, current, route),
    history: current.navigation.history,
  });
}

export function pushRouteState(
  current: AppViewState,
  route: PanelRoute,
): AppViewState {
  const nextRoute = normalizeRoute(current.snapshot, current, route);
  if (isSameRoute(current.navigation.current, nextRoute)) {
    return replaceRouteState(current, nextRoute);
  }

  return applyNavigation(current, {
    current: nextRoute,
    history: [...current.navigation.history, current.navigation.current],
  });
}

export function navigateBackState(current: AppViewState): AppViewState {
  const history = [...current.navigation.history];
  while (history.length > 0) {
    const candidate = normalizeRoute(current.snapshot, current, history.pop()!);
    if (isSameRoute(candidate, current.navigation.current)) {
      continue;
    }

    return applyNavigation(current, {
      current: candidate,
      history,
    });
  }

  return current;
}

export function isSameRoute(a: PanelRoute, b: PanelRoute): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function shouldReplaceDetailRoute(
  current: AppViewState,
  next: PanelRoute,
): boolean {
  return getRouteClass(current.navigation.current) === getRouteClass(next);
}

export function shouldHandleMouseBack(
  button: number,
  target: EventTarget | null,
  historyLength: number,
): boolean {
  return button === 3 && historyLength > 0 && !isEditableTarget(target);
}

export function removeSenderFromNavigation(
  current: AppViewState,
  senderId: string,
): AppViewState {
  const next = {
    ...current,
    selectedSenderId: current.selectedSenderId === senderId ? null : current.selectedSenderId,
    senderDraft: current.selectedSenderId === senderId ? null : current.senderDraft,
    selectedResponse:
      current.selectedResponse?.senderId === senderId ? null : current.selectedResponse,
    responseDraft:
      current.selectedResponse?.senderId === senderId ? null : current.responseDraft,
  };

  return applyNavigation(next, {
    current: routeReferencesSender(current.navigation.current, senderId)
      ? senderListRoute
      : current.navigation.current,
    history: current.navigation.history.filter(
      (route) => !routeReferencesSender(route, senderId),
    ),
  });
}

export function removeResponseFromNavigation(
  current: AppViewState,
  senderId: string,
  responseId: string,
  fallbackRoute: PanelRoute,
): AppViewState {
  return applyNavigation(current, {
    current: routeReferencesResponse(current.navigation.current, senderId, responseId)
      ? fallbackRoute
      : current.navigation.current,
    history: current.navigation.history.filter(
      (route) => !routeReferencesResponse(route, senderId, responseId),
    ),
  });
}

export function syncNavigationSnapshotState(
  current: AppViewState,
  next: AppViewState,
): AppViewState {
  const normalizedCurrent = normalizeSnapshotRoute(
    current,
    next.snapshot,
    current.navigation.current,
  );
  const normalizedHistory = current.navigation.history.map((route) =>
    normalizeSnapshotRoute(current, next.snapshot, route),
  );
  const cleared = clearDemotedRouteState(current, next, normalizedCurrent);

  return applyNavigation(cleared, {
    current: normalizedCurrent,
    history: normalizedHistory,
  });
}

function getRouteClass(route: PanelRoute): string {
  if (route.tab !== "rules") {
    return route.tab;
  }
  if (route.rulesSubTab === "matches") {
    return "rules-matches";
  }
  return `${route.rulesSubTab}-${route.detail}`;
}

function normalizeSnapshotRoute(
  current: AppViewState,
  snapshot: BridgePanelSnapshot | null,
  route: PanelRoute,
): PanelRoute {
  if (route.tab !== "rules" || route.rulesSubTab === "matches" || route.detail === "list") {
    return route;
  }
  if (route.rulesSubTab === "senders") {
    if ((snapshot?.senders ?? []).some((sender) => sender.id === route.senderId)) {
      return route;
    }
    if ((current.snapshot?.senders ?? []).some((sender) => sender.id === route.senderId)) {
      return senderListRoute;
    }
    return canOpenSenderDetail(snapshot, current, route.senderId) ? route : senderListRoute;
  }

  const nextSender = (snapshot?.senders ?? []).find((sender) => sender.id === route.senderId);
  if (nextSender?.responses.some((response) => response.id === route.responseId)) {
    return route;
  }
  const previousSender = (current.snapshot?.senders ?? []).find(
    (sender) => sender.id === route.senderId,
  );
  if (previousSender?.responses.some((response) => response.id === route.responseId)) {
    return responsesListRoute;
  }
  return canOpenResponseDetail(snapshot, current, route.senderId, route.responseId)
    ? route
    : responsesListRoute;
}

function clearDemotedRouteState(
  current: AppViewState,
  next: AppViewState,
  normalizedCurrent: PanelRoute,
): AppViewState {
  const previousRoute = current.navigation.current;
  if (
    previousRoute.tab !== "rules" ||
    previousRoute.rulesSubTab === "matches" ||
    previousRoute.detail === "list" ||
    isSameRoute(previousRoute, normalizedCurrent)
  ) {
    return next;
  }
  if (previousRoute.rulesSubTab === "senders") {
    return {
      ...next,
      selectedSenderId:
        next.selectedSenderId === previousRoute.senderId ? null : next.selectedSenderId,
      senderDraft:
        next.selectedSenderId === previousRoute.senderId ? null : next.senderDraft,
      selectedResponse:
        next.selectedResponse?.senderId === previousRoute.senderId
          ? null
          : next.selectedResponse,
      responseDraft:
        next.selectedResponse?.senderId === previousRoute.senderId
          ? null
          : next.responseDraft,
    };
  }

  const senderStillExists = (next.snapshot?.senders ?? []).some(
    (sender) => sender.id === previousRoute.senderId,
  );
  return {
    ...next,
    selectedSenderId:
      senderStillExists || next.selectedSenderId !== previousRoute.senderId
        ? next.selectedSenderId
        : null,
    senderDraft:
      senderStillExists || next.selectedSenderId !== previousRoute.senderId
        ? next.senderDraft
        : null,
    selectedResponse:
      next.selectedResponse?.senderId === previousRoute.senderId &&
      next.selectedResponse.responseId === previousRoute.responseId
        ? null
        : next.selectedResponse,
    responseDraft:
      next.selectedResponse?.senderId === previousRoute.senderId &&
      next.selectedResponse.responseId === previousRoute.responseId
        ? null
        : next.responseDraft,
  };
}

function applyNavigation(
  current: AppViewState,
  navigation: AppViewState["navigation"],
): AppViewState {
  const compactHistory = dedupeHistory(navigation.history, navigation.current);
  const next = {
    ...current,
    navigation: {
      current: navigation.current,
      history: compactHistory,
    },
  };
  return applyRouteProjection(next, navigation.current);
}

function dedupeHistory(
  history: PanelRoute[],
  current: PanelRoute,
): PanelRoute[] {
  const compact: PanelRoute[] = [];
  history.forEach((route) => {
    if (compact.length === 0 || !isSameRoute(compact[compact.length - 1], route)) {
      compact.push(route);
    }
  });

  while (compact.length > 0 && isSameRoute(compact[compact.length - 1], current)) {
    compact.pop();
  }
  return compact;
}

function normalizeRoute(
  snapshot: BridgePanelSnapshot | null,
  current: AppViewState,
  route: PanelRoute,
): PanelRoute {
  if (route.tab !== "rules") {
    return route;
  }
  if (route.rulesSubTab === "matches") {
    return route;
  }
  if (route.detail === "list") {
    return route;
  }
  if (route.rulesSubTab === "senders") {
    return canOpenSenderDetail(snapshot, current, route.senderId) ? route : senderListRoute;
  }
  return canOpenResponseDetail(snapshot, current, route.senderId, route.responseId)
    ? route
    : responsesListRoute;
}

function applyRouteProjection(
  current: AppViewState,
  route: PanelRoute,
): AppViewState {
  if (route.tab !== "rules") {
    return {
      ...current,
      activeTab: route.tab,
    };
  }
  if (route.rulesSubTab === "matches") {
    return {
      ...current,
      activeTab: "rules",
      rulesSubTab: "matches",
      narrowDetailOpen: false,
    };
  }
  if (route.detail === "list") {
    return {
      ...current,
      activeTab: "rules",
      rulesSubTab: route.rulesSubTab,
      narrowDetailOpen: false,
    };
  }
  if (route.rulesSubTab === "senders") {
    const sender = findSender(current.snapshot?.senders ?? [], route.senderId);
    if (sender) {
      return openSenderState(current, sender, "senders");
    }

    return {
      ...current,
      activeTab: "rules",
      rulesSubTab: "senders",
      narrowDetailOpen: true,
      selectedSenderId: route.senderId,
    };
  }

  const record = findResponseRecord(current.snapshot?.senders ?? [], {
    senderId: route.senderId,
    responseId: route.responseId,
  });
  if (record) {
    return openResponseState(current, record.sender, record.response, "responses");
  }
  if (canOpenResponseDetail(current.snapshot, current, route.senderId, route.responseId)) {
    return {
      ...current,
      activeTab: "rules",
      rulesSubTab: "responses",
      narrowDetailOpen: true,
    };
  }

  return {
    ...current,
    activeTab: "rules",
    rulesSubTab: "responses",
    narrowDetailOpen: true,
    selectedSenderId: route.senderId,
    selectedResponse: {
      senderId: route.senderId,
      responseId: route.responseId,
    },
  };
}

function canOpenSenderDetail(
  snapshot: BridgePanelSnapshot | null,
  current: AppViewState,
  senderId: string,
): boolean {
  if ((snapshot?.senders ?? []).some((sender) => sender.id === senderId)) {
    return true;
  }
  return current.selectedSenderId === senderId && current.senderDraft?.id === senderId;
}

function canOpenResponseDetail(
  snapshot: BridgePanelSnapshot | null,
  current: AppViewState,
  senderId: string,
  responseId: string,
): boolean {
  const sender = (snapshot?.senders ?? []).find((item) => item.id === senderId);
  if (sender?.responses.some((response) => response.id === responseId)) {
    return true;
  }
  return (
    current.selectedResponse?.senderId === senderId &&
    current.selectedResponse.responseId === responseId &&
    current.responseDraft?.senderId === senderId &&
    current.responseDraft.id === responseId
  );
}

function routeReferencesSender(route: PanelRoute, senderId: string): boolean {
  return route.tab === "rules" && route.rulesSubTab !== "matches" && route.detail === "detail"
    ? route.senderId === senderId
    : false;
}

function routeReferencesResponse(
  route: PanelRoute,
  senderId: string,
  responseId: string,
): boolean {
  return route.tab === "rules" &&
    route.rulesSubTab === "responses" &&
    route.detail === "detail"
    ? route.senderId === senderId && route.responseId === responseId
    : false;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!target || typeof target !== "object") {
    return false;
  }

  const candidate = target as {
    tagName?: string;
    isContentEditable?: boolean;
  };
  if (candidate.isContentEditable) {
    return true;
  }

  return ["INPUT", "TEXTAREA", "SELECT"].includes(candidate.tagName ?? "");
}
