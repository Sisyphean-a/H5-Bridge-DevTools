import { describe, expect, it } from "vitest";
import {
  createDefaultOriginState,
  getOriginProfile,
  importRulePackageIntoOriginState,
} from "./storage";
import type { RulePackage } from "./rulePackage";

const rulePackage: RulePackage = {
  version: 1,
  name: "客户 Demo",
  profile: {
    id: "customer-demo",
    title: "客户 Demo",
    hostObject: "CustomerBridge",
    requestEventField: "event",
  },
  settings: { autoMock: false, maxLogCount: 50 },
  senders: [
    {
      id: "login",
      name: "登录",
      matchEvent: "login",
      activeResponseId: "login-ok",
      lastActiveResponseId: "login-ok",
      responses: [
        {
          id: "login-ok",
          name: "成功",
          delayMs: 0,
          mode: "dispatchEvent",
          eventName: "login",
          detail: { success: true },
        },
      ],
    },
  ],
};

describe("规则包存储", () => {
  it("导入新规则包会注册动态方案、切换当前方案并应用设置", () => {
    const initial = createDefaultOriginState();
    const next = importRulePackageIntoOriginState(initial, rulePackage, "replace");

    expect(next.activeProfileId).toBe("customer-demo");
    expect(next.profileDefinitions["customer-demo"]).toEqual(rulePackage.profile);
    expect(next.knownHostObjects).toContain("CustomerBridge");
    expect(next.profiles["customer-demo"]).toMatchObject({
      settings: { autoMock: false, maxLogCount: 50 },
      senders: [{ matchEvent: "login" }],
    });
    expect(next.profiles.pkg01).toBe(initial.profiles.pkg01);
  });

  it("读取旧方案定义时默认使用 event 作为请求事件字段", () => {
    const state = createDefaultOriginState();
    state.profileDefinitions.legacy = {
      id: "legacy",
      title: "旧方案",
      hostObject: "LegacyBridge",
    };

    expect(getOriginProfile(state, "legacy").requestEventField).toBe("event");
  });

  it("更新同一方案时会保留旧宿主以便注入端恢复旧 mock", () => {
    const first = importRulePackageIntoOriginState(createDefaultOriginState(), rulePackage, "replace");
    const updated = importRulePackageIntoOriginState(
      first,
      { ...rulePackage, profile: { ...rulePackage.profile, hostObject: "UpdatedBridge" } },
      "replace",
    );

    expect(updated.knownHostObjects).toEqual(
      expect.arrayContaining(["CustomerBridge", "UpdatedBridge"]),
    );
  });
});
