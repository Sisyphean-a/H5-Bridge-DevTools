import { createId } from "./id";
import type { BridgeMockRule } from "./ruleTypes";

const presetRules: BridgeMockRule[] = [
  {
    id: "preset-login-success",
    name: "登录成功",
    enabled: true,
    match: { event: "toLogin" },
    response: {
      delayMs: 500,
      mode: "dispatchEvent",
      eventName: "toLogin",
      detail: {
        success: true,
        token: "mock-token-001",
        userId: "mock-user-001",
      },
    },
  },
  {
    id: "preset-login-failed",
    name: "登录失败",
    enabled: false,
    match: { event: "toLogin" },
    response: {
      delayMs: 500,
      mode: "dispatchEvent",
      eventName: "toLogin",
      detail: { success: false, msg: "mock login failed" },
    },
  },
  {
    id: "preset-camera-success",
    name: "相机成功",
    enabled: true,
    match: { event: "openCamera" },
    response: {
      delayMs: 1000,
      mode: "dispatchEvent",
      eventName: "openCamera",
      detail: {
        success: true,
        uri: "mock://camera/photo-001.jpg",
        data: "mock-image-data",
      },
    },
  },
  {
    id: "preset-camera-cancel",
    name: "相机取消",
    enabled: false,
    match: { event: "openCamera" },
    response: {
      delayMs: 800,
      mode: "dispatchEvent",
      eventName: "openCamera",
      detail: { success: false, msg: "user cancelled camera" },
    },
  },
  {
    id: "preset-contact-success",
    name: "联系人成功",
    enabled: true,
    match: { event: "getContact" },
    response: {
      delayMs: 800,
      mode: "dispatchEvent",
      eventName: "getContact",
      detail: { success: true, name: "张三", phone: "13800000000" },
    },
  },
  {
    id: "preset-contact-failed",
    name: "联系人失败",
    enabled: false,
    match: { event: "getContact" },
    response: {
      delayMs: 800,
      mode: "dispatchEvent",
      eventName: "getContact",
      detail: { success: false, msg: "user cancelled contact selection" },
    },
  },
  {
    id: "preset-liveness-success",
    name: "活体成功",
    enabled: true,
    match: { event: "startLiveness" },
    response: {
      delayMs: 1200,
      mode: "dispatchEvent",
      eventName: "startLiveness",
      detail: { success: true, faceImg: "mock-face-image-base64" },
    },
  },
  {
    id: "preset-liveness-failed",
    name: "活体失败",
    enabled: false,
    match: { event: "startLiveness" },
    response: {
      delayMs: 1200,
      mode: "dispatchEvent",
      eventName: "startLiveness",
      detail: { success: false, msg: "mock liveness failed" },
    },
  },
  {
    id: "preset-location-success",
    name: "定位成功",
    enabled: true,
    match: { event: "getLocation" },
    response: {
      delayMs: 500,
      mode: "dispatchEvent",
      eventName: "getLocation",
      detail: { latitude: "-12.0464", longitude: "-77.0428" },
    },
  },
  {
    id: "preset-upload-big-json-success",
    name: "上传大 JSON 成功",
    enabled: true,
    match: { event: "uploadBigJson" },
    response: {
      delayMs: 500,
      mode: "dispatchEvent",
      eventName: "uploadBigJson",
      detail: { success: "true", msg: "ok" },
    },
  },
  {
    id: "preset-base-request-success",
    name: "baseRequest 成功",
    enabled: true,
    match: { event: "baseRequest" },
    response: {
      delayMs: 500,
      mode: "dispatchEvent",
      eventName: "baseRequest",
      detail: { success: true, code: "200", msg: "ok", data: {} },
    },
  },
];

export const presetRuleOptions = presetRules.map((rule) => ({
  id: rule.id,
  label: rule.name,
}));

export function getPresetRules(): BridgeMockRule[] {
  return presetRules.map((rule) => ({
    ...rule,
    match: { ...rule.match },
    response: {
      ...rule.response,
      detail: JSON.parse(JSON.stringify(rule.response.detail)),
    },
    meta: {
      createdAt: Date.now(),
      updatedAt: Date.now(),
      hitCount: 0,
    },
  }));
}

export function createBlankRule(): BridgeMockRule {
  const now = Date.now();
  return {
    id: createId("rule"),
    name: "新规则",
    enabled: true,
    match: { event: "" },
    response: {
      delayMs: 500,
      mode: "dispatchEvent",
      eventName: "",
      detail: {},
    },
    meta: {
      createdAt: now,
      updatedAt: now,
      hitCount: 0,
    },
  };
}
