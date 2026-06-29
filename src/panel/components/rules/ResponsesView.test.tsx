import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { buildResponseDetailRoute } from "../../navigationState";
import { createResponseDraft } from "../../utils";
import type { PanelController } from "../../usePanelController";
import { createResponse, createSender } from "../../../test/factories";
import { createStandaloneSender } from "../../../shared/standaloneSender";
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
      navigation: {
        current: buildResponseDetailRoute(sender.id, response.id),
        history: [],
      },
      responseDraft: createResponseDraft(sender.id, response),
      narrowDetailOpen: true,
    },
    setState: vi.fn(),
    selectedResponseRecord: {
      sender,
      response,
      isActive: true,
      isStandalone: false,
      ownerLabel: sender.name,
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

  it("列表模式会提供独立安卓发送入口", () => {
    const regular = createSender("sender-1", { name: "登录发送" });
    const standalone = createStandaloneSender([
      createResponse("resp-2", { name: "系统返回", eventName: "nativeBack" }),
    ]);
    const markup = renderToStaticMarkup(
      <ResponsesView
        controller={
          {
            state: {
              snapshot: { senders: [regular, standalone] },
              selectedSenderId: null,
              selectedResponse: null,
              responseDraft: null,
              filterText: "",
              narrowDetailOpen: false,
            },
            setState: vi.fn(),
            responseCount: 2,
            filteredSenders: [regular],
            filteredResponses: [
              {
                sender: standalone,
                response: standalone.responses[0],
                isActive: false,
                isStandalone: true,
                ownerLabel: "独立发送",
              },
            ],
            createResponseForSender: vi.fn(),
            selectResponse: vi.fn(),
          } as unknown as PanelController
        }
        isWide
      />,
    );

    expect(markup).toContain("独立发送（不跟踪 H5 -&gt; 安卓）");
    expect(markup).toContain("独立发送");
    expect(markup).toContain("系统返回");
  });
});
