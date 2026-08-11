import type { BridgePanelSnapshot } from "../shared/bridgeTypes";
import { parseRulePackage, type RulePackage } from "../shared/rulePackage";

export function exportRulePackageFile(snapshot: BridgePanelSnapshot): void {
  const rulePackage: RulePackage = {
    version: 1,
    name: snapshot.activeProfile.title,
    profile: { ...snapshot.activeProfile },
    settings: { ...snapshot.settings },
    senders: snapshot.senders,
  };
  const blob = new Blob([JSON.stringify(rulePackage, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `h5-桥接规则包-${snapshot.activeProfile.id}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

export async function parseImportedRulePackage(content: string): Promise<
  | { ok: true; rulePackage: RulePackage }
  | { ok: false; error: string }
> {
  try {
    const { parse: parseYaml } = await import("yaml");
    const parsed = parseYaml(content);
    const result = parseRulePackage(parsed);
    return result.ok ? { ok: true, rulePackage: result.value } : result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "无法解析文件";
    return { ok: false, error: `规则包格式无效: ${message}` };
  }
}
