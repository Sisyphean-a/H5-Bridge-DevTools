import { describe, expect, it } from "vitest";
import {
  deleteResponseState,
  setActiveResponseState,
  updateHitCountState,
  upsertResponseState,
  upsertSenderState,
} from "./senderState";
import { createResponse, createSender } from "../test/factories";

describe("content sender state", () => {
  it("upsertSenderState 会补齐 meta 并更新现有 sender", () => {
    const existing = createSender("sender-1", {
      name: "旧名称",
      meta: { createdAt: 10, updatedAt: 20, hitCount: 3 },
    });
    const next = createSender("sender-1", {
      name: "新名称",
      meta: { updatedAt: 99, hitCount: 8 },
    });

    const result = upsertSenderState([existing], next, 200);

    expect(result).toEqual([
      expect.objectContaining({
        id: "sender-1",
        name: "新名称",
        meta: { createdAt: 200, updatedAt: 200, hitCount: 8 },
      }),
    ]);
  });

  it("setActiveResponseState 遇到不存在的 responseId 会保留原值", () => {
    const first = createResponse("resp-1");
    const second = createResponse("resp-2");
    const sender = createSender("sender-1", {
      responses: [first, second],
      activeResponseId: first.id,
    });

    const result = setActiveResponseState([sender], sender.id, "missing", 400);

    expect(result[0]?.activeResponseId).toBe(first.id);
    expect(result[0]?.meta?.updatedAt).toBe(400);
  });

  it("upsertResponseState 会给空 sender 自动激活首个响应", () => {
    const sender = createSender("sender-1", {
      responses: [],
      activeResponseId: null,
    });
    const response = createResponse("resp-1", {
      meta: { updatedAt: 9, hitCount: 2 },
    });

    const result = upsertResponseState([sender], sender.id, response, 500);

    expect(result[0]?.responses).toHaveLength(1);
    expect(result[0]?.activeResponseId).toBe(response.id);
    expect(result[0]?.responses[0]).toMatchObject({
      id: response.id,
      meta: { createdAt: 500, updatedAt: 500, hitCount: 2 },
    });
  });

  it("deleteResponseState 会在删除当前激活响应后切到剩余第一条", () => {
    const first = createResponse("resp-1");
    const second = createResponse("resp-2");
    const sender = createSender("sender-1", {
      responses: [first, second],
      activeResponseId: first.id,
    });

    const result = deleteResponseState([sender], sender.id, first.id);

    expect(result[0]?.responses.map((item) => item.id)).toEqual([second.id]);
    expect(result[0]?.activeResponseId).toBe(second.id);
  });

  it("updateHitCountState 会同时增加 sender 和 response 的命中次数", () => {
    const response = createResponse("resp-1", {
      meta: { createdAt: 1, updatedAt: 2, hitCount: 4 },
    });
    const sender = createSender("sender-1", {
      responses: [response],
      activeResponseId: response.id,
      meta: { createdAt: 1, updatedAt: 2, hitCount: 7 },
    });

    const result = updateHitCountState([sender], sender.id, response.id, 600);

    expect(result[0]?.meta).toEqual({ createdAt: 1, updatedAt: 600, hitCount: 8 });
    expect(result[0]?.responses[0]?.meta).toEqual({
      createdAt: 1,
      updatedAt: 600,
      hitCount: 5,
    });
  });
});
