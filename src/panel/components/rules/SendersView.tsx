import type { PanelController } from "../../usePanelController";
import { SenderDetailPane } from "./SenderDetailPane";
import { SendersListPane } from "./SendersListPane";

export function SendersView({
  controller,
  isWide,
}: {
  controller: PanelController;
  isWide: boolean;
}) {
  const showDetail = isWide || controller.state.narrowDetailOpen;
  if (!isWide && showDetail && controller.state.senderDraft) {
    return <SenderDetailPane controller={controller} compact />;
  }

  return (
    <div className={`split-view${isWide ? "" : " split-view--stack"}`}>
      <div className="split-pane split-pane--list">
        <SendersListPane controller={controller} />
      </div>
      {isWide ? (
        <div className="split-pane split-pane--detail">
          <SenderDetailPane controller={controller} />
        </div>
      ) : null}
    </div>
  );
}
