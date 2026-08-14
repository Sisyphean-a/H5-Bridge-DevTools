import { describe, expect, it } from "vitest";
import { boundedJsonText, sanitizeForStorage } from "./json";

describe("sanitizeForStorage", () => {
  it("字符串原样返回", () => {
    expect(sanitizeForStorage("hello")).toBe("hello");
  });

  it("普通 JSON 对象返回等价副本", () => {
    const value = { event: "openCamera", data: { uri: "mock://camera/a.jpg" } };
    expect(sanitizeForStorage(value)).toEqual(value);
  });

  it("BigInt 转为字符串", () => {
    const sanitized = sanitizeForStorage({ n: 10n, nested: { m: 5n } }) as {
      n: string;
      nested: { m: string };
    };
    expect(sanitized.n).toBe("10");
    expect(sanitized.nested.m).toBe("5");
  });

  it("循环引用降级为可读文本而不是抛出", () => {
    const circular: Record<string, unknown> = { event: "x" };
    circular.self = circular;

    const sanitized = sanitizeForStorage(circular);

    expect(typeof sanitized).toBe("string");
    expect(sanitized).toContain("Circular");
  });

  it("函数属性被丢弃（与 JSON.stringify 语义一致）", () => {
    const sanitized = sanitizeForStorage({ event: "x", fn: () => 1 }) as Record<string, unknown>;
    expect(sanitized).toEqual({ event: "x" });
  });

  it("undefined 与 null 原样返回", () => {
    expect(sanitizeForStorage(undefined)).toBeUndefined();
    expect(sanitizeForStorage(null)).toBeNull();
    expect(sanitizeForStorage(42)).toBe(42);
  });
});

describe("boundedJsonText", () => {
  it("输出 JSON 风格文本并遵守预算", () => {
    const value = { event: "openCamera", data: "x".repeat(500) };
    const text = boundedJsonText(value, 60);

    expect(text.length).toBeLessThanOrEqual(61);
    expect(text).toContain("openCamera");
  });

  it("循环引用安全", () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    expect(() => boundedJsonText(circular, 200)).not.toThrow();
    expect(boundedJsonText(circular, 200)).toContain("Circular");
  });

  it("BigInt 安全", () => {
    expect(() => boundedJsonText({ n: 10n }, 200)).not.toThrow();
    expect(boundedJsonText({ n: 10n }, 200)).toContain("10n");
  });

  it("预算为 0 时返回空串", () => {
    expect(boundedJsonText({ a: 1 }, 0)).toBe("");
  });
});
