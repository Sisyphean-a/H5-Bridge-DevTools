import { safeParseJson } from "../shared/json";
import { exportSendersFile, parseImportedSenders } from "./fileActions";
import { createManualEmitDraft, formatManualEmit } from "./utils";
import type { PanelActionContext } from "./actionContext";
import { postCommand, setToast } from "./actionContext";

export function createInitialManualEmitDraft() {
  return createManualEmitDraft();
}

export function sendManualEmit(context: PanelActionContext): void {
  const parsed = safeParseJson(context.state.manualEmit.detailText);
  if (!parsed.ok) {
    setToast(context, "error", `Detail JSON 无效: ${parsed.error}`);
    return;
  }
  postCommand(context, {
    type: "MANUAL_EMIT",
    eventName: context.state.manualEmit.eventName.trim(),
    detail: parsed.value,
  });
  setToast(context, "success", "已发送");
}

export function formatManualEmitDraft(context: PanelActionContext): void {
  context.setState((current) => ({
    ...current,
    manualEmit: formatManualEmit(current.manualEmit),
  }));
}

export function exportRules(context: PanelActionContext): void {
  const snapshot = context.state.snapshot;
  if (!snapshot) {
    return;
  }
  exportSendersFile(window.location.origin, snapshot.senders);
  setToast(context, "success", "已导出");
}

export function importRules(context: PanelActionContext, content: string): void {
  const result = parseImportedSenders(content);
  if (!result.ok) {
    setToast(context, "error", result.error);
    return;
  }
  postCommand(context, {
    type: "IMPORT_SENDERS",
    senders: result.senders,
    strategy: context.state.importStrategy,
  });
  setToast(context, "success", "已导入");
}

export function copyText(context: PanelActionContext, text: string): void {
  navigator.clipboard.writeText(text).then(
    () => setToast(context, "success", "已复制"),
    () => setToast(context, "error", "复制失败"),
  );
}
