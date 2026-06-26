import { describe, expect, it, vi } from "vitest";
import { applyPreviewCommand, createPreviewSnapshot } from "./previewState";
import { createResponse, createSender } from "../test/factories";

describe("preview state", () => {
  it("REQUEST_SNAPSHOT 不会改动快照", () => {
    const snapshot = createPreviewSnapshot();

    const next = applyPreviewCommand(snapshot, { type: "REQUEST_SNAPSHOT" });

    expect(next).toBe(snapshot);
  });

  it("UPSERT_RESPONSE 会给空 sender 自动设置 activeResponseId", () => {
    const sender = createSender("sender-1", {
      responses: [],
      activeResponseId: null,
    });
    const response = createResponse("resp-1");

    const next = applyPreviewCommand(
      { ...createPreviewSnapshot(), senders: [sender], logs: [] },
      {
        type: "UPSERT_RESPONSE",
        senderId: sender.id,
        response,
      },
    );

    expect(next.senders[0]?.responses.map((item) => item.id)).toEqual([response.id]);
    expect(next.senders[0]?.activeResponseId).toBe(response.id);
  });

  it("DELETE_RESPONSE 删除当前激活项后会切到剩余第一条", () => {
    const first = createResponse("resp-1");
    const second = createResponse("resp-2");
    const sender = createSender("sender-1", {
      responses: [first, second],
      activeResponseId: first.id,
    });

    const next = applyPreviewCommand(
      { ...createPreviewSnapshot(), senders: [sender], logs: [] },
      {
        type: "DELETE_RESPONSE",
        senderId: sender.id,
        responseId: first.id,
      },
    );

    expect(next.senders[0]?.responses.map((item) => item.id)).toEqual([second.id]);
    expect(next.senders[0]?.activeResponseId).toBe(second.id);
  });

  it("TRIGGER_RESPONSE 会派发事件并追加 EMIT 日志", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-26T00:00:00.000Z"));
    const response = createResponse("resp-1", {
      eventName: "loginCallback",
      detail: { ok: true },
    });
    const sender = createSender("sender-1", {
      responses: [response],
      activeResponseId: response.id,
    });
    const dispatchEvent = vi.fn();

    const next = applyPreviewCommand(
      { ...createPreviewSnapshot(), senders: [sender], logs: [] },
      {
        type: "TRIGGER_RESPONSE",
        senderId: sender.id,
        responseId: response.id,
      },
      dispatchEvent,
    );

    expect(dispatchEvent).toHaveBeenCalledWith("loginCallback", { ok: true });
    expect(next.logs[0]).toMatchObject({
      type: "EMIT",
      event: "loginCallback",
      response: { ok: true },
    });
    vi.useRealTimers();
  });
});
