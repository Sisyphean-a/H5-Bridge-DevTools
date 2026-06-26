import { describe, expect, it } from "vitest";
import {
  findEquivalentResponseIndex,
  mergeImportedSenders,
  normalizeSenders,
} from "./rules";
import { createResponse, createSender } from "../test/factories";

describe("shared rules behavior", () => {
  it("findEquivalentResponseIndex 会在 id 不同的情况下按响应签名匹配", () => {
    const existing = createResponse("resp-a", {
      name: "登录成功",
      delayMs: 80,
      eventName: "login",
      detail: { ok: true },
    });
    const target = createResponse("resp-b", {
      name: "登录成功",
      delayMs: 80,
      eventName: "login",
      detail: { ok: true },
    });

    expect(findEquivalentResponseIndex([existing], target)).toBe(0);
  });

  it("normalizeSenders 会按 matchEvent 合并 sender，并优先保留启用项的激活响应", () => {
    const first = createResponse("resp-1", { eventName: "login", detail: { step: 1 } });
    const second = createResponse("resp-2", { eventName: "login", detail: { step: 2 } });
    const merged = normalizeSenders([
      createSender("sender-a", {
        name: "登录 / 旧",
        enabled: false,
        matchEvent: "login",
        responses: [first],
        activeResponseId: first.id,
        meta: { createdAt: 10, updatedAt: 20, hitCount: 2 },
      }),
      createSender("sender-b", {
        name: "登录 / 新",
        enabled: true,
        matchEvent: "login",
        responses: [second],
        activeResponseId: second.id,
        meta: { createdAt: 5, updatedAt: 30, hitCount: 3 },
      }),
    ]);

    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({
      name: "登录",
      enabled: true,
      matchEvent: "login",
      activeResponseId: second.id,
      meta: { createdAt: 5, updatedAt: 30, hitCount: 5 },
    });
    expect(merged[0].responses.map((response) => response.id)).toEqual([first.id, second.id]);
  });

  it("mergeImportedSenders 在 appendDisabled 下会关闭导入 sender 并生成新 id", () => {
    const imported = createSender("sender-imported", {
      enabled: true,
      matchEvent: "camera",
    });

    const merged = mergeImportedSenders([], [imported], "appendDisabled");

    expect(merged).toHaveLength(1);
    expect(merged[0].enabled).toBe(false);
    expect(merged[0].matchEvent).toBe("camera");
    expect(merged[0].id).not.toBe(imported.id);
    expect(merged[0].responses[0]?.id).not.toBe(imported.responses[0]?.id);
  });
});
