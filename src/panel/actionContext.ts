import type { Dispatch, SetStateAction } from "react";
import type { PanelCommand, PanelCommandRequest } from "../shared/messageTypes";
import type { AppViewState, ToastState } from "./types";

export interface PanelActionContext {
  dispatchRuntimeMessage: (message: PanelCommandRequest) => void;
  setState: Dispatch<SetStateAction<AppViewState>>;
  state: AppViewState;
  tabId: number;
}

export function postCommand(context: PanelActionContext, command: PanelCommand): void {
  context.dispatchRuntimeMessage({
    type: "PANEL_COMMAND",
    tabId: context.tabId,
    command,
  });
}

export function setToast(
  context: Pick<PanelActionContext, "setState">,
  level: ToastState["level"],
  message: string,
): void {
  context.setState((current) => ({
    ...current,
    toast: { level, message },
  }));
}
