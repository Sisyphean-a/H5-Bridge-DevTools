import type { BridgeProfileId } from "./bridgeProfiles";
import { createId } from "./id";
import type { BridgeResponseOption, BridgeSender } from "./senderTypes";

interface PresetResponseSeed {
  name: string;
  delayMs: number;
  eventName: string;
  detail: unknown;
}

interface PresetSenderSeed {
  id: string;
  name: string;
  matchEvent: string;
  responses: PresetResponseSeed[];
}

const presetSenderSeedsByProfile: Record<BridgeProfileId, PresetSenderSeed[]> = {
  pkg01: [
    {
      id: "preset-login",
      name: "登录",
      matchEvent: "toLogin",
      responses: [
        {
          name: "登录成功",
          delayMs: 500,
          eventName: "toLogin",
          detail: { success: true, token: "mock-token-001", userId: "mock-user-001" },
        },
        {
          name: "登录失败",
          delayMs: 500,
          eventName: "toLogin",
          detail: { success: false, msg: "mock login failed" },
        },
      ],
    },
    {
      id: "preset-camera",
      name: "相机",
      matchEvent: "openCamera",
      responses: [
        {
          name: "相机成功",
          delayMs: 1000,
          eventName: "openCamera",
          detail: { success: true, uri: "mock://camera/photo-001.jpg", data: "mock-image-data" },
        },
        {
          name: "相机取消",
          delayMs: 800,
          eventName: "openCamera",
          detail: { success: false, msg: "user cancelled camera" },
        },
      ],
    },
    {
      id: "preset-contact",
      name: "联系人",
      matchEvent: "getContact",
      responses: [
        {
          name: "联系人成功",
          delayMs: 800,
          eventName: "getContact",
          detail: { success: true, name: "张三", phone: "13800000000" },
        },
        {
          name: "联系人失败",
          delayMs: 800,
          eventName: "getContact",
          detail: { success: false, msg: "user cancelled contact selection" },
        },
      ],
    },
    {
      id: "preset-liveness",
      name: "活体检测",
      matchEvent: "startLiveness",
      responses: [
        {
          name: "活体成功",
          delayMs: 1200,
          eventName: "startLiveness",
          detail: { success: true, faceImg: "mock-face-image-base64" },
        },
        {
          name: "活体失败",
          delayMs: 1200,
          eventName: "startLiveness",
          detail: { success: false, msg: "mock liveness failed" },
        },
      ],
    },
    {
      id: "preset-location",
      name: "定位",
      matchEvent: "getLocation",
      responses: [
        {
          name: "定位成功",
          delayMs: 500,
          eventName: "getLocation",
          detail: { latitude: "-12.0464", longitude: "-77.0428" },
        },
      ],
    },
    {
      id: "preset-upload-big-json",
      name: "上传大 JSON",
      matchEvent: "uploadBigJson",
      responses: [
        {
          name: "上传成功",
          delayMs: 500,
          eventName: "uploadBigJson",
          detail: { success: "true", msg: "ok" },
        },
      ],
    },
    {
      id: "preset-base-request",
      name: "baseRequest",
      matchEvent: "baseRequest",
      responses: [
        {
          name: "请求成功",
          delayMs: 500,
          eventName: "baseRequest",
          detail: { success: true, code: "200", msg: "ok", data: {} },
        },
      ],
    },
  ],
  pkg03: [
    {
      id: "preset-login",
      name: "登录",
      matchEvent: "requestLogin",
      responses: [
        {
          name: "登录成功",
          delayMs: 500,
          eventName: "requestLogin",
          detail: { result: true, token: "mock-token-003", userId: "mock-user-003" },
        },
        {
          name: "登录失败",
          delayMs: 500,
          eventName: "requestLogin",
          detail: { result: false, msg: "mock login failed" },
        },
      ],
    },
    {
      id: "preset-camera",
      name: "相机",
      matchEvent: "getPicture",
      responses: [
        {
          name: "相机成功",
          delayMs: 1000,
          eventName: "getPicture",
          detail: { result: true, uri: "mock://camera/photo-003.jpg", data: "mock-image-data" },
        },
        {
          name: "相机取消",
          delayMs: 800,
          eventName: "getPicture",
          detail: { result: false, msg: "user cancelled camera" },
        },
      ],
    },
    {
      id: "preset-contact",
      name: "联系人",
      matchEvent: "getSystemContact",
      responses: [
        {
          name: "联系人成功",
          delayMs: 800,
          eventName: "getSystemContact",
          detail: { success: true, name: "张三", phone: "13800000000" },
        },
        {
          name: "联系人失败",
          delayMs: 800,
          eventName: "getSystemContact",
          detail: { success: false, msg: "user cancelled contact selection" },
        },
      ],
    },
    {
      id: "preset-liveness",
      name: "活体检测",
      matchEvent: "startLiveCheck",
      responses: [
        {
          name: "活体成功",
          delayMs: 1200,
          eventName: "startLiveCheck",
          detail: { result: true, faceImg: "mock-face-image-base64" },
        },
        {
          name: "活体失败",
          delayMs: 1200,
          eventName: "startLiveCheck",
          detail: { result: false, msg: "mock liveness failed" },
        },
      ],
    },
    {
      id: "preset-location",
      name: "定位",
      matchEvent: "getLocationData",
      responses: [
        {
          name: "定位成功",
          delayMs: 500,
          eventName: "getLocationData",
          detail: { latitude: "-12.0464", longitude: "-77.0428" },
        },
      ],
    },
    {
      id: "preset-upload-big-json",
      name: "上传大 JSON",
      matchEvent: "uploadRiskData",
      responses: [
        {
          name: "上传成功",
          delayMs: 500,
          eventName: "uploadRiskData",
          detail: { result: "true", msg: "ok" },
        },
      ],
    },
    {
      id: "preset-base-request",
      name: "androidRequest",
      matchEvent: "androidRequest",
      responses: [
        {
          name: "请求成功",
          delayMs: 500,
          eventName: "androidRequest",
          detail: { code: "200", msg: "ok", data: {} },
        },
      ],
    },
  ],
};

function instantiateResponse(seed: PresetResponseSeed): BridgeResponseOption {
  const now = Date.now();
  return {
    id: createId("resp"),
    name: seed.name,
    delayMs: seed.delayMs,
    mode: "dispatchEvent",
    eventName: seed.eventName,
    detail: JSON.parse(JSON.stringify(seed.detail)),
    meta: { createdAt: now, updatedAt: now, hitCount: 0 },
  };
}

function instantiateSender(seed: PresetSenderSeed): BridgeSender {
  const now = Date.now();
  const responses = seed.responses.map(instantiateResponse);
  return {
    id: createId("sender"),
    name: seed.name,
    matchEvent: seed.matchEvent,
    responses,
    activeResponseId: responses[0]?.id ?? null,
    lastActiveResponseId: responses[0]?.id ?? null,
    meta: { createdAt: now, updatedAt: now, hitCount: 0 },
  };
}

export function getPresetSenders(profileId: BridgeProfileId): BridgeSender[] {
  return presetSenderSeedsByProfile[profileId].map(instantiateSender);
}

export function getPresetSenderById(
  profileId: BridgeProfileId,
  presetId: string,
): BridgeSender | null {
  const seed = presetSenderSeedsByProfile[profileId].find((item) => item.id === presetId);
  return seed ? instantiateSender(seed) : null;
}

export function createBlankResponse(): BridgeResponseOption {
  const now = Date.now();
  return {
    id: createId("resp"),
    name: "新响应",
    delayMs: 500,
    mode: "dispatchEvent",
    eventName: "",
    detail: {},
    meta: { createdAt: now, updatedAt: now, hitCount: 0 },
  };
}

export function createBlankSender(): BridgeSender {
  const now = Date.now();
  const response = createBlankResponse();
  return {
    id: createId("sender"),
    name: "新发送",
    matchEvent: "",
    responses: [response],
    activeResponseId: response.id,
    lastActiveResponseId: response.id,
    meta: { createdAt: now, updatedAt: now, hitCount: 0 },
  };
}
