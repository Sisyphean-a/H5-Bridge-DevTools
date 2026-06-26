import { describe, expect, it } from "vitest";
import { createResponseDraft, createSenderDraft } from "./utils";
import { syncSnapshotState } from "./helpers";
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

    expect(next.senderDraft).toEqual(createSenderDraft(sender));
    expect(next.selectedSenderId).toBe(sender.id);
  });

  it("在响应仍存在时会保留本地已修改的 responseDraft", () => {
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
  });
});
