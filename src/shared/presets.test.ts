import { describe, expect, it } from "vitest";
import { getPresetSenderById, getPresetSenders } from "./presets";

describe("方案模板", () => {
  it("动态导入方案没有内置模板时返回空结果", () => {
    expect(getPresetSenders("credit-18-h5")).toEqual([]);
    expect(getPresetSenderById("credit-18-h5", "any")).toBeNull();
  });
});
