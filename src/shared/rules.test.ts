import { describe, expect, it } from "vitest";
import {
  findMatchingSender,
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

  it("normalizeSenders 会按 matchEvent 合并 sender，并优先保留已有的活跃响应", () => {
    const first = createResponse("resp-1", { eventName: "login", detail: { step: 1 } });
    const second = createResponse("resp-2", { eventName: "login", detail: { step: 2 } });
    const merged = normalizeSenders([
      createSender("sender-a", {
        name: "登录 / 旧",
        matchEvent: "login",
        responses: [first],
        activeResponseId: null,
        meta: { createdAt: 10, updatedAt: 20, hitCount: 2 },
      }),
      createSender("sender-b", {
        name: "登录 / 新",
        matchEvent: "login",
        responses: [second],
        activeResponseId: second.id,
        meta: { createdAt: 5, updatedAt: 30, hitCount: 3 },
      }),
    ]);

    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({
      name: "登录",
      matchEvent: "login",
      activeResponseId: second.id,
      meta: { createdAt: 5, updatedAt: 30, hitCount: 5 },
    });
    expect(merged[0].responses.map((response) => response.id)).toEqual([first.id, second.id]);
  });

  it("mergeImportedSenders 在 appendUnpaired 下会清空导入 sender 的活跃响应并生成新 id", () => {
    const imported = createSender("sender-imported", {
      matchEvent: "camera",
    });

    const merged = mergeImportedSenders([], [imported], "appendUnpaired");

    expect(merged).toHaveLength(1);
    expect(merged[0].activeResponseId).toBeNull();
    expect(merged[0].matchEvent).toBe("camera");
    expect(merged[0].id).not.toBe(imported.id);
    expect(merged[0].responses[0]?.id).not.toBe(imported.responses[0]?.id);
  });

  it("findMatchingSender 会跳过未关联活跃响应的 sender", () => {
    const disabledByUnpair = createSender("sender-a", {
      matchEvent: "login",
      activeResponseId: null,
    });
    const active = createSender("sender-b", {
      matchEvent: "login",
    });

    expect(findMatchingSender([disabledByUnpair], "login")).toBeUndefined();
    expect(findMatchingSender([disabledByUnpair, active], "login")?.id).toBe("sender-b");
  });
});
