import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { createResponseDraft } from "../../utils";
import type { PanelController } from "../../usePanelController";
import { createResponse, createSender } from "../../../test/factories";
import { ResponsesView } from "./ResponsesView";

function createController(): PanelController {
  const response = createResponse("response-1", {
    detail: { message: "plain text bridge" },
  });
  const sender = createSender("sender-1", {
    responses: [response],
    activeResponseId: response.id,
  });

  return {
    state: {
      responseDraft: createResponseDraft(sender.id, response),
      narrowDetailOpen: true,
    },
    setState: vi.fn(),
    selectedResponseRecord: {
      sender,
      response,
      isActive: true,
    },
  } as unknown as PanelController;
}

describe("ResponsesView", () => {
  it("默认显示文字模式，不直接铺开图片工具", () => {
    const markup = renderToStaticMarkup(
      <ResponsesView controller={createController()} isWide={false} />,
    );

    expect(markup).toContain("编辑模式");
    expect(markup).toContain("文字模式");
    expect(markup).toContain("图片模式");
    expect(markup).toContain("Detail JSON");
    expect(markup).not.toContain("写入格式");
    expect(markup).not.toContain("选择图片");
  });
});
