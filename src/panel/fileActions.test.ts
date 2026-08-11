import { describe, expect, it } from "vitest";
import { parseImportedRulePackage } from "./fileActions";

describe("规则包文件导入", () => {
  it("接受 YAML 规则包并补全缺失的规则 id", () => {
    const result = parseImportedRulePackage(`
version: 1
name: Demo 规则包
profile:
  id: demo-app
  title: Demo App
  hostObject: DemoBridge
settings:
  autoMock: true
senders:
  - name: 登录
    matchEvent: login
    responses:
      - name: 成功
        delayMs: 0
        eventName: login
        detail:
          success: true
`);

    expect(result).toMatchObject({
      ok: true,
      rulePackage: {
        name: "Demo 规则包",
        profile: { id: "demo-app", title: "Demo App", hostObject: "DemoBridge" },
        settings: { autoMock: true },
      },
    });
    if (result.ok) {
      expect(result.rulePackage.senders[0]).toMatchObject({
        name: "登录",
        matchEvent: "login",
        activeResponseId: result.rulePackage.senders[0]?.responses[0]?.id,
      });
      expect(result.rulePackage.senders[0]?.id).toMatch(/^sender-/);
      expect(result.rulePackage.senders[0]?.responses[0]?.id).toMatch(/^resp-/);
    }
  });

  it("拒绝含循环 detail 的 YAML 规则包", () => {
    expect(
      parseImportedRulePackage(`
version: 1
name: 循环
profile: { id: cyclic, title: 循环, hostObject: CyclicBridge }
senders:
  - name: 测试
    matchEvent: test
    responses:
      - name: 响应
        delayMs: 0
        eventName: test
        detail: &detail { self: *detail }
`),
    ).toEqual({
      ok: false,
      error: "senders[0].responses[0].detail 必须可序列化为 JSON",
    });
  });

  it("拒绝覆盖保留 window 全局的宿主对象", () => {
    expect(
      parseImportedRulePackage(`version: 1\nname: 保留\nprofile: { id: reserved, title: 保留, hostObject: alert }\nsenders: []`),
    ).toEqual({
      ok: false,
      error: "profile 必须包含合法的 id、title 和 hostObject",
    });
  });

  it("拒绝只读的 window.undefined 宿主对象", () => {
    expect(
      parseImportedRulePackage(`version: 1\nname: 未定义\nprofile: { id: undefined-host, title: 未定义, hostObject: undefined }\nsenders: []`),
    ).toEqual({
      ok: false,
      error: "profile 必须包含合法的 id、title 和 hostObject",
    });
  });

  it("拒绝不完整的规则包", () => {
    expect(
      parseImportedRulePackage(`version: 1\nname: 缺少宿主\nprofile: { id: demo, title: Demo }\nsenders: []`),
    ).toEqual({
      ok: false,
      error: "profile 必须包含合法的 id、title 和 hostObject",
    });
  });
});
