import type { BridgeMockRule } from "../shared/ruleTypes";
import { createRulesExport } from "../shared/storage";
import { safeParseJson } from "../shared/json";

export function exportRulesFile(origin: string, rules: BridgeMockRule[]): void {
  const payload = createRulesExport(origin, rules);
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

export function parseImportedRules(content: string): {
  ok: true;
  rules: BridgeMockRule[];
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

  const maybeRules = Reflect.get(parsed.value, "rules");
  if (!Array.isArray(maybeRules)) {
    return { ok: false, error: "导入内容中未找到 rules 数组" };
  }

  return { ok: true, rules: maybeRules as BridgeMockRule[] };
}
