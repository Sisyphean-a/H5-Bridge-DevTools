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
  it("默认显示 JSON 编辑区，图片字段工具需点击后再展开", () => {
    const markup = renderToStaticMarkup(
      <ResponsesView controller={createController()} isWide={false} />,
    );

    expect(markup).toContain("Detail JSON");
    expect(markup).toContain("添加图片字段");
    expect(markup).not.toContain("图片格式");
    expect(markup).not.toContain("选择图片");
    expect(markup).not.toContain("插入图片");
  });
});
