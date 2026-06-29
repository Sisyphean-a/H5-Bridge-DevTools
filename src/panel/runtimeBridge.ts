import { useEffect, useMemo } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { BridgePanelSnapshot } from "../shared/bridgeTypes";
import { STORAGE_KEY } from "../shared/constants";
import type {
  PanelCommandRequest,
  PanelCommandResponse,
} from "../shared/messageTypes";
import { buildSnapshot } from "../shared/storage";
import { setToast } from "./actionContext";
import {
  hasActiveExtensionRuntime,
  isExtensionContextInvalidatedError,
  syncSnapshotState,
} from "./helpers";
import type { AppViewState } from "./types";

const panelContextInvalidatedMessage = "扩展已重载，请关闭并重新打开 DevTools 面板。";

interface TabUpdateInfo {
  status?: string;
  url?: string;
}

export function usePanelRuntime(
  tabId: number,
  setState: Dispatch<SetStateAction<AppViewState>>,
): (message: PanelCommandRequest) => void {
  const dispatchRuntimeMessage = useMemo(
    () => (message: PanelCommandRequest) => {
      void sendPanelCommand(message, setState);
    },
    [setState],
  );

  useEffect(() => {
    let disposed = false;

    const refreshSnapshot = async () => {
      try {
        const snapshot = await loadSnapshotForTab(tabId);
        if (disposed) {
          return;
        }
        setState((current) =>
          snapshot ? syncSnapshotState(current, snapshot) : { ...current, snapshot: null },
        );
      } catch (error) {
        if (!disposed) {
          setToast({ setState }, "error", toErrorMessage(error));
        }
      }
    };

    const ensureAndRefresh = async () => {
      const ready = await ensureTabReady(tabId, setState);
      if (!ready) {
        return;
      }
      await refreshSnapshot();
    };

    const handleStorageChange = (
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: string,
    ) => {
      if (areaName !== "local" || !changes[STORAGE_KEY]) {
        return;
      }
      void refreshSnapshot();
    };

    const handleTabUpdate = (
      updatedTabId: number,
      changeInfo: TabUpdateInfo,
    ) => {
      if (updatedTabId !== tabId) {
        return;
      }
      if (typeof changeInfo.url !== "string" && changeInfo.status !== "complete") {
        return;
      }
      void ensureAndRefresh();
    };

    const handleTabRemoved = (removedTabId: number) => {
      if (removedTabId !== tabId || disposed) {
        return;
      }
      setState((current) => ({ ...current, snapshot: null }));
    };

    void ensureAndRefresh();
    chrome.storage.onChanged.addListener(handleStorageChange);
    chrome.tabs.onUpdated.addListener(handleTabUpdate);
    chrome.tabs.onRemoved.addListener(handleTabRemoved);

    return () => {
      disposed = true;
      chrome.storage.onChanged.removeListener(handleStorageChange);
      chrome.tabs.onUpdated.removeListener(handleTabUpdate);
      chrome.tabs.onRemoved.removeListener(handleTabRemoved);
    };
  }, [tabId, setState]);

  return dispatchRuntimeMessage;
}

export async function loadSnapshotForTab(
  tabId: number,
): Promise<BridgePanelSnapshot | null> {
  const location = await getTabLocation(tabId);
  if (!location) {
    return null;
  }
  return buildSnapshot(location.origin, location.href);
}

async function ensureTabReady(
  tabId: number,
  setState: Dispatch<SetStateAction<AppViewState>>,
): Promise<boolean> {
  try {
    const response = await sendRuntimeMessage({
      type: "PANEL_COMMAND",
      tabId,
      command: { type: "REQUEST_SNAPSHOT" },
    });
    if (!response.ok) {
      setToast({ setState }, "error", response.message);
      return false;
    }
    return true;
  } catch (error) {
    setToast({ setState }, "error", toErrorMessage(error));
    return false;
  }
}

async function sendPanelCommand(
  message: PanelCommandRequest,
  setState: Dispatch<SetStateAction<AppViewState>>,
): Promise<void> {
  try {
    const response = await sendRuntimeMessage(message);
    if (!response.ok) {
      setToast({ setState }, "error", response.message);
    }
  } catch (error) {
    setToast({ setState }, "error", toErrorMessage(error));
  }
}

async function sendRuntimeMessage(
  message: PanelCommandRequest,
): Promise<PanelCommandResponse> {
  const runtime = chrome.runtime;
  if (!hasActiveExtensionRuntime(runtime)) {
    return { ok: false, message: panelContextInvalidatedMessage };
  }

  try {
    return await runtime.sendMessage(message) as PanelCommandResponse;
  } catch (error) {
    if (isExtensionContextInvalidatedError(error)) {
      return { ok: false, message: panelContextInvalidatedMessage };
    }
    throw error;
  }
}

async function getTabLocation(
  tabId: number,
): Promise<{ href: string; origin: string } | null> {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (typeof tab.url !== "string") {
      return null;
    }

    const url = new URL(tab.url);
    if (url.origin === "null") {
      return null;
    }

    return {
      href: url.href,
      origin: url.origin,
    };
  } catch (error) {
    if (isExtensionContextInvalidatedError(error)) {
      return null;
    }
    throw error;
  }
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "未知错误";
}
