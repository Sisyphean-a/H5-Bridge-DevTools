import { describe, expect, it } from "vitest";
import { createInitialManualEmitDraft } from "./panelActions";
import type { PanelActionContext } from "./actionContext";
import {
  buildRulesSubTabRoute,
  buildTabRoute,
  buildResponseDetailRoute,
} from "./navigationState";
import {
  createResponseForSender,
  deleteResponse,
  saveResponse,
  selectResponse,
} from "./responseActions";
import { createSenderFromLogEntry, deleteSender, selectSender } from "./senderActions";
import type { AppViewState } from "./types";
import { createResponseDraft, createSenderDraft } from "./utils";
import { createResponse, createSender, createSnapshot } from "../test/factories";
import type { BridgeLogItem } from "../shared/bridgeTypes";
import { STANDALONE_SENDER_ID } from "../shared/standaloneSender";

function createState(
  overrides: Partial<AppViewState> = {},
): AppViewState {
  return {
    navigation: {
      current: buildRulesSubTabRoute("senders"),
      history: [],
    },
    snapshot: createSnapshot(),
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
    ...overrides,
  };
}

function createHarness(initialState: AppViewState) {
  let state = initialState;
  const messages: unknown[] = [];
  const context = {
    dispatchRuntimeMessage(message: unknown) {
      messages.push(message);
    },
    setState(updater) {
      state = typeof updater === "function" ? updater(state) : updater;
    },
    get state() {
      return state;
    },
    tabId: 7,
  } as PanelActionContext;

  return {
    context,
    getState() {
      return state;
    },
    messages,
  };
}

describe("panel action flows", () => {
  it("selectSender 会选中 sender 并创建草稿", () => {
    const sender = createSender("sender-1", { name: "登录发送" });
    const harness = createHarness(
      createState({
        snapshot: createSnapshot({ senders: [sender] }),
      }),
    );

    selectSender(harness.context, sender.id);

    expect(harness.getState().selectedSenderId).toBe(sender.id);
    expect(harness.getState().senderDraft).toEqual(createSenderDraft(sender));
    expect(harness.getState().narrowDetailOpen).toBe(true);
    expect(harness.getState().navigation.history).toEqual([
      { tab: "rules", rulesSubTab: "senders", detail: "list" },
    ]);
    expect(harness.getState().navigation.current).toEqual({
      tab: "rules",
      rulesSubTab: "senders",
      detail: "detail",
      senderId: sender.id,
    });
  });

  it("deleteSender 会发送删除命令并清空关联选中状态", () => {
    const response = createResponse("resp-1");
    const sender = createSender("sender-1", { responses: [response], activeResponseId: response.id });
    const harness = createHarness(
      createState({
        snapshot: createSnapshot({ senders: [sender] }),
        selectedSenderId: sender.id,
        senderDraft: createSenderDraft(sender),
        selectedResponse: { senderId: sender.id, responseId: response.id },
        responseDraft: createResponseDraft(sender.id, response),
      }),
    );

    deleteSender(harness.context);

    expect(harness.messages).toEqual([
      {
        type: "PANEL_COMMAND",
        tabId: 7,
        command: { type: "DELETE_SENDER", senderId: sender.id },
      },
    ]);
    expect(harness.getState().selectedSenderId).toBeNull();
    expect(harness.getState().selectedResponse).toBeNull();
    expect(harness.getState().responseDraft).toBeNull();
    expect(harness.getState().navigation.current).toEqual({
      tab: "rules",
      rulesSubTab: "senders",
      detail: "list",
    });
  });

  it("createResponseForSender 会为无响应 sender 建立响应并激活", () => {
    const sender = createSender("sender-1", { responses: [], activeResponseId: null });
    const harness = createHarness(
      createState({
        snapshot: createSnapshot({ senders: [sender] }),
      }),
    );

    createResponseForSender(harness.context, sender.id);

    const messages = harness.messages as Array<{
      type: "PANEL_COMMAND";
      tabId: number;
      command: Record<string, unknown> & {
        response?: { id: string };
      };
    }>;
    const createdResponseId = messages[0]?.command.response?.id;

    expect(messages).toHaveLength(2);
    expect(createdResponseId).toBeTruthy();
    expect(messages[0]).toMatchObject({
      type: "PANEL_COMMAND",
      tabId: 7,
      command: { type: "UPSERT_RESPONSE", senderId: sender.id },
    });
    expect(messages[1]).toEqual({
      type: "PANEL_COMMAND",
      tabId: 7,
      command: {
        type: "SET_ACTIVE_RESPONSE",
        senderId: sender.id,
        responseId: createdResponseId,
      },
    });
    expect(harness.getState().selectedResponse).toEqual({
      senderId: sender.id,
      responseId: createdResponseId,
    });
    expect(harness.getState().rulesSubTab).toBe("responses");
    expect(harness.getState().navigation.current).toEqual({
      tab: "rules",
      rulesSubTab: "responses",
      detail: "detail",
      senderId: sender.id,
      responseId: createdResponseId,
    });
  });

  it("createResponseForSender 支持创建不跟踪 H5 发送的独立安卓发送", () => {
    const harness = createHarness(createState());

    createResponseForSender(harness.context, STANDALONE_SENDER_ID);

    const messages = harness.messages as Array<{
      type: "PANEL_COMMAND";
      tabId: number;
      command: { type: string; sender?: { id: string; responses: Array<{ id: string }> } };
    }>;
    const createdResponseId = messages[0]?.command.sender?.responses[0]?.id;

    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      type: "PANEL_COMMAND",
      tabId: 7,
      command: {
        type: "UPSERT_SENDER",
        sender: { id: STANDALONE_SENDER_ID },
      },
    });
    expect(createdResponseId).toBeTruthy();
    expect(harness.getState().selectedSenderId).toBeNull();
    expect(harness.getState().senderDraft).toBeNull();
    expect(harness.getState().selectedResponse).toEqual({
      senderId: STANDALONE_SENDER_ID,
      responseId: createdResponseId,
    });
  });

  it("deleteResponse 会切到同 sender 的下一个响应", () => {
    const first = createResponse("resp-1", { name: "响应一" });
    const second = createResponse("resp-2", { name: "响应二" });
    const sender = createSender("sender-1", {
      responses: [first, second],
      activeResponseId: first.id,
    });
    const harness = createHarness(
      createState({
        snapshot: createSnapshot({ senders: [sender] }),
        navigation: {
          current: buildResponseDetailRoute(sender.id, first.id),
          history: [{ tab: "rules", rulesSubTab: "matches" }],
        },
        selectedResponse: { senderId: sender.id, responseId: first.id },
        responseDraft: createResponseDraft(sender.id, first),
      }),
    );

    deleteResponse(harness.context);

    expect(harness.messages).toEqual([
      {
        type: "PANEL_COMMAND",
        tabId: 7,
        command: {
          type: "DELETE_RESPONSE",
          senderId: sender.id,
          responseId: first.id,
        },
      },
    ]);
    expect(harness.getState().selectedResponse).toEqual({
      senderId: sender.id,
      responseId: second.id,
    });
    expect(harness.getState().responseDraft).toEqual(createResponseDraft(sender.id, second));
    expect(harness.getState().navigation.current).toEqual(
      buildResponseDetailRoute(sender.id, second.id),
    );
  });

  it("deleteResponse 删除最后一条独立安卓发送时会清理隐藏容器", () => {
    const response = createResponse("resp-1", { name: "原生返回" });
    const sender = createSender(STANDALONE_SENDER_ID, {
      name: "独立安卓发送",
      matchEvent: "__android-standalone-emit__",
      responses: [response],
      activeResponseId: null,
      lastActiveResponseId: response.id,
    });
    const harness = createHarness(
      createState({
        snapshot: createSnapshot({ senders: [sender] }),
        navigation: {
          current: buildResponseDetailRoute(sender.id, response.id),
          history: [{ tab: "rules", rulesSubTab: "responses", detail: "list" }],
        },
        selectedResponse: { senderId: sender.id, responseId: response.id },
        responseDraft: createResponseDraft(sender.id, response),
        rulesSubTab: "responses",
      }),
    );

    deleteResponse(harness.context);

    expect(harness.messages).toEqual([
      {
        type: "PANEL_COMMAND",
        tabId: 7,
        command: {
          type: "DELETE_RESPONSE",
          senderId: sender.id,
          responseId: response.id,
        },
      },
      {
        type: "PANEL_COMMAND",
        tabId: 7,
        command: {
          type: "DELETE_SENDER",
          senderId: sender.id,
        },
      },
    ]);
    expect(harness.getState().selectedResponse).toBeNull();
    expect(harness.getState().responseDraft).toBeNull();
    expect(harness.getState().navigation.current).toEqual(buildRulesSubTabRoute("responses"));
  });

  it("saveResponse 遇到非法 JSON 会保留本地状态并提示错误", () => {
    const response = createResponse("resp-1");
    const sender = createSender("sender-1", { responses: [response], activeResponseId: response.id });
    const harness = createHarness(
      createState({
        snapshot: createSnapshot({ senders: [sender] }),
        selectedResponse: { senderId: sender.id, responseId: response.id },
        responseDraft: {
          ...createResponseDraft(sender.id, response),
          detailText: "{bad json}",
        },
      }),
    );

    saveResponse(harness.context);

    expect(harness.messages).toEqual([]);
    expect(harness.getState().toast?.level).toBe("error");
    expect(harness.getState().toast?.message).toContain("Detail JSON 无效");
  });

  it("从匹配页进入响应详情时会把来源页压入历史", () => {
    const response = createResponse("resp-1");
    const sender = createSender("sender-1", {
      responses: [response],
      activeResponseId: response.id,
    });
    const harness = createHarness(
      createState({
        navigation: {
          current: { tab: "rules", rulesSubTab: "matches" },
          history: [],
        },
        rulesSubTab: "matches",
        snapshot: createSnapshot({ senders: [sender] }),
      }),
    );

    selectResponse(harness.context, sender.id, response.id);

    expect(harness.getState().navigation.history).toEqual([
      { tab: "rules", rulesSubTab: "matches" },
    ]);
    expect(harness.getState().navigation.current).toEqual(
      buildResponseDetailRoute(sender.id, response.id),
    );
  });

  it("从日志页创建规则时会把日志页压入历史", () => {
    const log: BridgeLogItem = {
      id: "log-1",
      type: "SEND",
      event: "openCamera",
      timestamp: 1,
      payload: { event: "openCamera", data: { ok: true } },
    };
    const harness = createHarness(
      createState({
        navigation: {
          current: buildTabRoute(createState(), "logs"),
          history: [],
        },
        activeTab: "logs",
      }),
    );

    createSenderFromLogEntry(harness.context, log);

    expect(harness.getState().navigation.history).toEqual([{ tab: "logs" }]);
    expect(harness.getState().navigation.current).toEqual({
      tab: "rules",
      rulesSubTab: "senders",
      detail: "detail",
      senderId: harness.getState().selectedSenderId!,
    });
    expect(harness.getState().rulesSubTab).toBe("senders");
    expect(harness.getState().senderDraft).not.toBeNull();
  });
});
