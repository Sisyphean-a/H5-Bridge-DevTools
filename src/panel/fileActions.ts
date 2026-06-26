import type { BridgeSender } from "../shared/senderTypes";
import { safeParseJson } from "../shared/json";

export function exportSendersFile(origin: string, senders: BridgeSender[]): void {
  const payload = { origin, senders, exportedAt: Date.now() };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `h5-桥接规则-${Date.now()}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

export function parseImportedSenders(content: string): {
  ok: true;
  senders: BridgeSender[];
} | {
  ok: false;
  error: string;
} {
  const parsed = safeParseJson(content);
  if (!parsed.ok) {
    return { ok: false, error: `导入 JSON 无效: ${parsed.error}` };
  }

  if (!parsed.value || typeof parsed.value !== "object") {
    return { ok: false, error: "导入内容必须是对象" };
  }

  const maybeSenders = Reflect.get(parsed.value, "senders");
  if (!Array.isArray(maybeSenders)) {
    return { ok: false, error: "导入内容中未找到 senders 数组" };
  }

  return { ok: true, senders: maybeSenders as BridgeSender[] };
}
