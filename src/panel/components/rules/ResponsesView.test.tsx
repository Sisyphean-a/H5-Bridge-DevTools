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
  it("默认同时显示 JSON 编辑区和图片字段插入工具", () => {
    const markup = renderToStaticMarkup(
      <ResponsesView controller={createController()} isWide={false} />,
    );

    expect(markup).toContain("Detail JSON");
    expect(markup).toContain("图片字段");
    expect(markup).toContain("图片格式");
    expect(markup).toContain("选择图片");
    expect(markup).toContain("插入图片");
    expect(markup).not.toContain("编辑模式");
  });
});
