import { describe, expect, it } from "vitest";
import {
  createMockAndroidUri,
  suggestImageFieldPathFromText,
  writeImageValueToDetailText,
} from "./imageTools";

describe("imageTools", () => {
  it("会优先命中现有的 base64 图片字段", () => {
    const detailText = JSON.stringify({
      success: true,
      result: { faceImg: "old-value" },
    });

    expect(suggestImageFieldPathFromText(detailText, "base64")).toBe("result.faceImg");
  });

  it("可按点路径写入图片值", () => {
    const result = writeImageValueToDetailText('{"success":true,"result":{}}', "result.faceImg", "abc123");

    expect(result).toEqual({
      ok: true,
      detailText: JSON.stringify(
        {
          success: true,
          result: { faceImg: "abc123" },
        },
        null,
        2,
      ),
    });
  });

  it("会生成稳定的模拟 Android URI", () => {
    expect(createMockAndroidUri("My Photo.JPG")).toBe(
      "mock://selected-image/my-photo.jpg",
    );
  });
});
