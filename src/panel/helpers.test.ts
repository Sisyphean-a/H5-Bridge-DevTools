import { describe, expect, it } from "vitest";
import { createResponseDraft, createSenderDraft } from "./utils";
import {
  hasActiveExtensionRuntime,
  isExtensionContextInvalidatedError,
  syncSnapshotState,
} from "./helpers";
import type { AppViewState } from "./types";
import { createInitialManualEmitDraft } from "./panelActions";
import { createResponse, createSender, createSnapshot } from "../test/factories";

function createViewState(
  snapshotOverrides: Parameters<typeof createSnapshot>[0] = {},
): AppViewState {
  return {
    snapshot: createSnapshot(snapshotOverrides),
    selectedSenderId: null,
    senderDraft: null,
    selectedResponse: null,
    responseDraft: null,
    manualEmit: createInitialManualEmitDraft(),
    filterText: "",
    activeLogEvent: null,
    toast: null,
    importStrategy: "merge",
    activeTab: "rules",
    rulesSubTab: "senders",
    narrowDetailOpen: false,
  };
}

describe("syncSnapshotState", () => {
  it("在缺少 senderDraft 时会按最新快照补齐", () => {
    const sender = createSender("sender-1", { name: "新名称", matchEvent: "updated-event" });
    const current = {
      ...createViewState(),
      snapshot: null,
      selectedSenderId: sender.id,
      senderDraft: null,
    };

    const next = syncSnapshotState(
      current,
      createSnapshot({
        senders: [sender],
      }),
    );

    expect(next.senderDraft).toEqual(createSenderDraft(sender));
  });

  it("只要已有 senderDraft，就会保留本地草稿而不是跟随新快照刷新", () => {
    const sender = createSender("sender-1", { name: "旧名称" });
    const current = {
      ...createViewState({ senders: [sender] }),
      selectedSenderId: sender.id,
      senderDraft: createSenderDraft(sender),
    };

    const nextSnapshot = createSnapshot({
      senders: [{ ...sender, name: "新名称", matchEvent: "updated-event" }],
    });

    const next = syncSnapshotState(current, nextSnapshot);

    expect(next.senderDraft).toEqual(createSenderDraft(nextSnapshot.senders[0]));
    expect(next.selectedSenderId).toBe(sender.id);
    expect(next.toast).toBeNull();
  });

  it("本地已修改 senderDraft 时会保留草稿并提示远端更新", () => {
    const sender = createSender("sender-1", { name: "旧名称" });
    const current = {
      ...createViewState({ senders: [sender] }),
      selectedSenderId: sender.id,
      senderDraft: { ...createSenderDraft(sender), name: "本地修改名称" },
    };

    const nextSnapshot = createSnapshot({
      senders: [{ ...sender, name: "远端新名称", matchEvent: "updated-event" }],
    });

    const next = syncSnapshotState(current, nextSnapshot);

    expect(next.senderDraft?.name).toBe("本地修改名称");
    expect(next.toast).toEqual({
      level: "info",
      message: "已收到远端发送更新，当前保留本地未保存草稿。",
    });
  });

  it("未修改的 responseDraft 会跟随远端快照刷新", () => {
    const response = createResponse("resp-1", { name: "旧响应" });
    const sender = createSender("sender-1", { responses: [response], activeResponseId: response.id });
    const current = {
      ...createViewState({ senders: [sender] }),
      selectedResponse: { senderId: sender.id, responseId: response.id },
      responseDraft: createResponseDraft(sender.id, response),
    };

    const next = syncSnapshotState(
      current,
      createSnapshot({
        senders: [
          createSender(sender.id, {
            ...sender,
            responses: [{ ...response, name: "远端响应更新" }],
          }),
        ],
      }),
    );

    expect(next.responseDraft?.name).toBe("远端响应更新");
    expect(next.toast).toBeNull();
  });

  it("在响应仍存在时会保留本地已修改的 responseDraft 并提示远端更新", () => {
    const response = createResponse("resp-1", { name: "旧响应" });
    const sender = createSender("sender-1", { responses: [response], activeResponseId: response.id });
    const current = {
      ...createViewState({ senders: [sender] }),
      selectedResponse: { senderId: sender.id, responseId: response.id },
      responseDraft: { ...createResponseDraft(sender.id, response), name: "本地响应修改" },
    };

    const next = syncSnapshotState(
      current,
      createSnapshot({
        senders: [
          createSender(sender.id, {
            ...sender,
            responses: [{ ...response, name: "远端响应更新" }],
          }),
        ],
      }),
    );

    expect(next.responseDraft?.name).toBe("本地响应修改");
    expect(next.selectedResponse).toEqual({ senderId: sender.id, responseId: response.id });
    expect(next.toast).toEqual({
      level: "info",
      message: "已收到远端响应更新，当前保留本地未保存草稿。",
    });
  });
});

describe("panel runtime guards", () => {
  it("只有 runtime id 和 connect 都存在时才允许重连", () => {
    const connect = (() => {
      throw new Error("not implemented");
    }) as typeof chrome.runtime.connect;

    expect(hasActiveExtensionRuntime({ id: "ext-1", connect })).toBe(true);
    expect(hasActiveExtensionRuntime(undefined)).toBe(false);
    expect(hasActiveExtensionRuntime({ id: "ext-1" })).toBe(false);
    expect(hasActiveExtensionRuntime({ connect })).toBe(false);
    expect(hasActiveExtensionRuntime({ id: "", connect })).toBe(false);
  });

  it("会识别扩展上下文失效错误", () => {
    expect(
      isExtensionContextInvalidatedError(new Error("Extension context invalidated.")),
    ).toBe(true);
    expect(
      isExtensionContextInvalidatedError(new Error("Attempting to use a disconnected port object")),
    ).toBe(false);
    expect(isExtensionContextInvalidatedError("Extension context invalidated")).toBe(false);
  });
});
