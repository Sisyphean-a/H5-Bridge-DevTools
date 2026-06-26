import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { runPreviewScenario } from "./previewScenarios";
import { installPreviewChrome } from "./previewRuntime";
import "./styles.css";

installPreviewChrome();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App tabId={1} />
  </React.StrictMode>,
);

runPreviewScenario();
