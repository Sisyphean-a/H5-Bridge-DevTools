import { describe, expect, it } from "vitest";
import type { BridgeLogItem, OriginScopedBridgeState } from "../shared/bridgeTypes";
import { createDefaultOriginState } from "./storage";
import { createResponse, createSender } from "../test/factories";
import {
  applyCommandToRuntimeState,
  prependLog,
  trimLogs,
  type StateCommand,
} from "./stateCommands";

describe("stateCommands", () => {
  it("同一命令应用到两份相同副本后收敛为相同状态", () => {
    const base = createDefaultOriginState();
    const copyA = structuredClone(base);
    const copyB = structuredClone(base);
    const commands: StateCommand[] = [
      {
        type: "APPEND_LOG",
        log: createLog("log-1", "openCamera"),
      },
      {
        type: "RECORD_BRIDGE_CALL",
        log: createLog("log-2", "toLogin"),
        extraLog: createLog("log-3", "toLogin", "WARN"),
        hit: { senderId: "sender-a", responseId: "resp-a", now: 42 },
      },
      {
        type: "UPSERT_SENDER",
        sender: createSender("sender-a", { matchEvent: "toLogin" }),
        now: 42,
      },
      {
        type: "SET_ACTIVE_RESPONSE",
        senderId: "sender-a",
        responseId: null,
        now: 43,
      },
      {
        type: "UPDATE_SETTINGS",
        settings: { maxLogCount: 50 },
      },
    ];

    for (const command of commands) {
      applyCommandToRuntimeState({ globalEnabled: true, originState: copyA }, command);
      applyCommandToRuntimeState({ globalEnabled: true, originState: copyB }, command);
    }

    expect(copyA).toEqual(copyB);
  });

  it("RECORD_BRIDGE_CALL 同时记录 SEND 日志、额外日志与命中计数", () => {
    const state = seedStateWithSender();
    applyCommandToRuntimeState(state, {
      type: "RECORD_BRIDGE_CALL",
      log: createLog("log-1", "openCamera"),
      extraLog: createLog("log-2", "openCamera", "WARN"),
      hit: { senderId: "sender-a", responseId: "resp-a", now: 42 },
    });

    const profileState = state.originState.profiles.pkg01;
    expect(profileState.logs.map((log) => log.id)).toEqual(["log-2", "log-1"]);
    expect(profileState.senders[0].meta?.hitCount).toBe(1);
    expect(profileState.senders[0].responses[0].meta?.hitCount).toBe(1);
  });

  it("SET_GLOBAL_ENABLED 只更新全局开关", () => {
    const state = {
      globalEnabled: false,
      originState: createDefaultOriginState(),
    };
    applyCommandToRuntimeState(state, { type: "SET_GLOBAL_ENABLED", enabled: true });
    expect(state.globalEnabled).toBe(true);
  });

  it("REPLACE_ORIGIN_STATE 整体替换 origin 切片", () => {
    const state = {
      globalEnabled: true,
      originState: createDefaultOriginState(),
    };
    const replacement = createDefaultOriginState();
    replacement.activeProfileId = "pkg03";
    applyCommandToRuntimeState(state, { type: "REPLACE_ORIGIN_STATE", originState: replacement });
    expect(state.originState.activeProfileId).toBe("pkg03");
  });

  it("prependLog 与 trimLogs 遵守 maxLogCount", () => {
    const logs: BridgeLogItem[] = [
      createLog("log-3", "c"),
      createLog("log-2", "b"),
      createLog("log-1", "a"),
    ];
    expect(prependLog(logs, createLog("log-4", "d"), 3).map((log) => log.id)).toEqual([
      "log-4",
      "log-3",
      "log-2",
    ]);
    expect(trimLogs(logs, 2).map((log) => log.id)).toEqual(["log-3", "log-2"]);
  });

  it("SET_ACTIVE_PROFILE 只接受已存在的方案", () => {
    const state = {
      globalEnabled: true,
      originState: createDefaultOriginState(),
    };
    applyCommandToRuntimeState(state, { type: "SET_ACTIVE_PROFILE", profileId: "missing" });
    expect(state.originState.activeProfileId).toBe("pkg01");
    applyCommandToRuntimeState(state, { type: "SET_ACTIVE_PROFILE", profileId: "pkg03" });
    expect(state.originState.activeProfileId).toBe("pkg03");
  });
});

function seedStateWithSender(): { globalEnabled: boolean; originState: OriginScopedBridgeState } {
  const originState = createDefaultOriginState();
  const response = createResponse("resp-a", { eventName: "openCamera" });
  originState.profiles.pkg01.senders = [
    createSender("sender-a", {
      matchEvent: "openCamera",
      responses: [response],
      activeResponseId: "resp-a",
      lastActiveResponseId: "resp-a",
      meta: { createdAt: 1, updatedAt: 1, hitCount: 0 },
    }),
  ];
  return { globalEnabled: true, originState };
}

function createLog(
  id: string,
  event: string,
  type: BridgeLogItem["type"] = "SEND",
): BridgeLogItem {
  return { id, timestamp: 1, type, event, payload: {} };
}
