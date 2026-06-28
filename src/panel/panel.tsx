import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import "./styles.css";

const tabId = resolvePanelTabId();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App tabId={tabId} />
  </React.StrictMode>,
);

function resolvePanelTabId(): number {
  const queryTabId = new URLSearchParams(window.location.search).get("tabId");
  if (queryTabId) {
    const parsed = Number(queryTabId);
    if (Number.isInteger(parsed) && parsed >= 0) {
      return parsed;
    }
  }

  const devtoolsTabId = chrome.devtools?.inspectedWindow?.tabId;
  if (typeof devtoolsTabId === "number" && Number.isInteger(devtoolsTabId)) {
    return devtoolsTabId;
  }

  throw new Error("Panel tabId is unavailable.");
}
