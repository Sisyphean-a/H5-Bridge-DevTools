export function safeParseJson(value: string): {
  ok: true;
  value: unknown;
} | {
  ok: false;
  error: string;
} {
  try {
    return { ok: true, value: JSON.parse(value) };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid JSON";
    return { ok: false, error: message };
  }
}

export function formatJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

export function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
