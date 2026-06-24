export function createId(prefix = "id"): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  const token = Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now()}-${token}`;
}
