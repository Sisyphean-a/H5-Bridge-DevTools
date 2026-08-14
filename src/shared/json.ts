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

/**
 * 把页面传入的任意值转换为可安全写入 chrome.storage 的 JSON 值。
 * BigInt 转字符串、循环引用/函数等不可序列化内容降级为可读文本。
 * 字符串直接返回（字符串永远可安全存储）。
 */
export function sanitizeForStorage(value: unknown): unknown {
  if (value === null || typeof value !== "object") {
    return value;
  }

  try {
    const text = JSON.stringify(value, (_key, item: unknown) =>
      typeof item === "bigint" ? item.toString() : item,
    );
    if (text !== undefined) {
      return JSON.parse(text) as unknown;
    }
  } catch {
    // 循环引用等：落入文本降级
  }

  return boundedJsonText(value, 4096);
}

/**
 * 生成有长度预算的 JSON 风格文本。预算耗尽即截断，
 * 循环引用与 BigInt 不会抛出，适合日志搜索索引与摘要展示。
 */
export function boundedJsonText(value: unknown, budget: number): string {
  const parts: string[] = [];
  let remaining = Math.max(0, budget);
  const seen = new WeakSet<object>();

  const push = (text: string): void => {
    if (remaining <= 0) {
      return;
    }
    const clipped = text.slice(0, remaining);
    parts.push(clipped);
    remaining -= clipped.length;
  };

  const visit = (item: unknown): void => {
    if (remaining <= 0) {
      return;
    }
    if (item === null) {
      push("null");
      return;
    }
    if (typeof item === "string") {
      push(JSON.stringify(item));
      return;
    }
    if (typeof item === "number" || typeof item === "boolean") {
      push(String(item));
      return;
    }
    if (typeof item === "bigint") {
      push(`${item}n`);
      return;
    }
    if (typeof item !== "object") {
      push(String(item));
      return;
    }
    if (seen.has(item)) {
      push('"[Circular]"');
      return;
    }
    seen.add(item);

    if (Array.isArray(item)) {
      push("[");
      item.forEach((entry, index) => {
        if (remaining <= 0) {
          return;
        }
        if (index > 0) {
          push(",");
        }
        visit(entry);
      });
      push("]");
      return;
    }

    push("{");
    Object.entries(item).forEach(([key, entry], index) => {
      if (remaining <= 0) {
        return;
      }
      if (index > 0) {
        push(",");
      }
      push(`${JSON.stringify(key)}:`);
      visit(entry);
    });
    push("}");
  };

  visit(value);
  const text = parts.join("");
  return text.length > budget ? `${text.slice(0, budget)}…` : text;
}
