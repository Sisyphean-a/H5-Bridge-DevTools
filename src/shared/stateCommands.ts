import type {
  BridgeLogItem,
  OriginBridgeProfileState,
  OriginScopedBridgeState,
} from "./bridgeTypes";
import type { BridgeProfileId } from "./bridgeProfiles";
import type { OriginBridgeSettings } from "./ruleTypes";
import type { BridgeResponseOption, BridgeSender } from "./senderTypes";
import { createDefaultProfileState } from "./storage";
import {
  deleteResponseState,
  deleteSenderState,
  setActiveResponseState,
  updateHitCountState,
  upsertResponseState,
  upsertSenderState,
} from "./senderState";

/**
 * 内容脚本与后台之间传递的状态增量命令。
 * 命令必须自包含且确定：id、时间戳由发送方生成并携带在命令里，
 * 两边各自应用到自己的最新副本后能收敛到相同状态。
 * 会生成新 id 的操作（导入、复制）在捕获侧物化为 REPLACE_* 命令。
 */
export type StateCommand =
  | { type: "RECORD_BRIDGE_CALL"; log: BridgeLogItem; extraLog: BridgeLogItem | null; hit: HitCountDelta | null }
  | { type: "APPEND_LOG"; log: BridgeLogItem }
  | { type: "CLEAR_LOGS" }
  | { type: "SET_GLOBAL_ENABLED"; enabled: boolean }
  | { type: "SET_ACTIVE_PROFILE"; profileId: BridgeProfileId }
  | { type: "UPDATE_SETTINGS"; settings: Partial<OriginBridgeSettings> }
  | { type: "REPLACE_SENDERS"; senders: BridgeSender[] }
  | { type: "REPLACE_ORIGIN_STATE"; originState: OriginScopedBridgeState }
  | { type: "UPSERT_SENDER"; sender: BridgeSender; now: number }
  | { type: "DELETE_SENDER"; senderId: string }
  | { type: "SET_ACTIVE_RESPONSE"; senderId: string; responseId: string | null; now: number }
  | { type: "UPSERT_RESPONSE"; senderId: string; response: BridgeResponseOption; now: number }
  | { type: "DELETE_RESPONSE"; senderId: string; responseId: string }
  | { type: "UPDATE_HIT_COUNT"; senderId: string; responseId: string; now: number };

export interface HitCountDelta {
  senderId: string;
  responseId: string;
  now: number;
}

/** 可被命令整体更新的运行时状态片段：全局开关 + 当前 origin 状态。 */
export interface CommandRuntimeState {
  globalEnabled: boolean;
  originState: OriginScopedBridgeState;
}

export function applyCommandToRuntimeState(
  state: CommandRuntimeState,
  command: StateCommand,
): void {
  if (command.type === "SET_GLOBAL_ENABLED") {
    state.globalEnabled = command.enabled;
    return;
  }
  if (command.type === "REPLACE_ORIGIN_STATE") {
    state.originState = command.originState;
    return;
  }
  applyOriginStateCommand(state.originState, command);
}

export function applyOriginStateCommand(
  originState: OriginScopedBridgeState,
  command: StateCommand,
): void {
  switch (command.type) {
    case "RECORD_BRIDGE_CALL": {
      const profileState = getProfileState(originState);
      profileState.logs = prependLog(profileState.logs, command.log, profileState.settings.maxLogCount);
      if (command.extraLog) {
        profileState.logs = prependLog(profileState.logs, command.extraLog, profileState.settings.maxLogCount);
      }
      if (command.hit) {
        profileState.senders = updateHitCountState(
          profileState.senders,
          command.hit.senderId,
          command.hit.responseId,
          command.hit.now,
        );
      }
      return;
    }
    case "APPEND_LOG": {
      const profileState = getProfileState(originState);
      profileState.logs = prependLog(profileState.logs, command.log, profileState.settings.maxLogCount);
      return;
    }
    case "CLEAR_LOGS":
      getProfileState(originState).logs = [];
      return;
    case "SET_ACTIVE_PROFILE":
      if (originState.profiles[command.profileId]) {
        originState.activeProfileId = command.profileId;
      }
      return;
    case "UPDATE_SETTINGS": {
      const profileState = getProfileState(originState);
      profileState.settings = { ...profileState.settings, ...command.settings };
      profileState.logs = trimLogs(profileState.logs, profileState.settings.maxLogCount);
      return;
    }
    case "REPLACE_SENDERS":
      getProfileState(originState).senders = command.senders;
      return;
    case "REPLACE_ORIGIN_STATE":
      Object.assign(originState, command.originState);
      return;
    case "UPSERT_SENDER":
      getProfileState(originState).senders = upsertSenderState(
        getProfileState(originState).senders,
        command.sender,
        command.now,
      );
      return;
    case "DELETE_SENDER":
      getProfileState(originState).senders = deleteSenderState(
        getProfileState(originState).senders,
        command.senderId,
      );
      return;
    case "SET_ACTIVE_RESPONSE":
      getProfileState(originState).senders = setActiveResponseState(
        getProfileState(originState).senders,
        command.senderId,
        command.responseId,
        command.now,
      );
      return;
    case "UPSERT_RESPONSE":
      getProfileState(originState).senders = upsertResponseState(
        getProfileState(originState).senders,
        command.senderId,
        command.response,
        command.now,
      );
      return;
    case "DELETE_RESPONSE":
      getProfileState(originState).senders = deleteResponseState(
        getProfileState(originState).senders,
        command.senderId,
        command.responseId,
      );
      return;
    case "UPDATE_HIT_COUNT":
      getProfileState(originState).senders = updateHitCountState(
        getProfileState(originState).senders,
        command.senderId,
        command.responseId,
        command.now,
      );
      return;
  }
}

export function prependLog(
  logs: BridgeLogItem[],
  log: BridgeLogItem,
  maxLogCount: number,
): BridgeLogItem[] {
  return [log, ...logs].slice(0, Math.max(1, maxLogCount));
}

export function trimLogs(
  logs: BridgeLogItem[],
  maxLogCount: number,
): BridgeLogItem[] {
  return logs.slice(0, Math.max(1, maxLogCount));
}

function getProfileState(originState: OriginScopedBridgeState): OriginBridgeProfileState {
  return (
    originState.profiles[originState.activeProfileId] ??
    createDefaultProfileState(originState.activeProfileId)
  );
}
