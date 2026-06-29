import { describe, expect, it } from "vitest";
import {
  countPairedSenders,
  countResponses,
  filterMatchSenders,
  filterResponseRecords,
  filterSenders,
} from "./controllerFilters";
import { createResponse, createSender } from "../test/factories";
import { createStandaloneSender } from "../shared/standaloneSender";

describe("controller filters", () => {
  it("发送列表和自动配对会隐藏独立安卓发送，但安卓发送列表会保留它", () => {
    const regular = createSender("sender-1", {
      name: "登录发送",
      matchEvent: "login",
      responses: [createResponse("resp-1", { name: "登录成功" })],
    });
    const standalone = createStandaloneSender([
      createResponse("resp-2", { name: "系统返回", eventName: "nativeBack" }),
    ]);

    expect(filterSenders([regular, standalone], "")).toEqual([regular]);
    expect(filterMatchSenders([regular, standalone], "")).toEqual([regular]);
    expect(countPairedSenders([regular, standalone])).toBe(1);
    expect(countResponses([regular, standalone])).toBe(2);

    const responseRecords = filterResponseRecords([regular, standalone], "");
    expect(responseRecords).toHaveLength(2);
    expect(responseRecords[1]).toMatchObject({
      isStandalone: true,
      ownerLabel: "独立发送",
    });
  });
});
