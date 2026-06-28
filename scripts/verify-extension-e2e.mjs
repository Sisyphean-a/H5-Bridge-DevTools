import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const extensionPath = join(root, "dist");

const tempRoot = await mkdtemp(join(tmpdir(), "h5-bridge-devtools-e2e-"));
const fixturePath = join(tempRoot, "e2e-fixture.png");
const userDataDir = join(tempRoot, "chrome-profile");

await writeFile(
  fixturePath,
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9s8MaqcAAAAASUVORK5CYII=",
    "base64",
  ),
);

const server = createServer((request, response) => {
  if (!request.url) {
    response.writeHead(404);
    response.end("missing url");
    return;
  }

  if (request.url === "/page-a.html" || request.url === "/page-b.html") {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(renderBridgePage());
    return;
  }

  response.writeHead(404);
  response.end("not found");
});

try {
  const port = await listen(server);
  const origin = `http://127.0.0.1:${port}`;
  const pageAUrl = `${origin}/page-a.html`;
  const pageBUrl = `${origin}/page-b.html`;
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-default-apps",
    ],
  });

  try {
    const background = await waitForExtensionServiceWorker(context);
    const extensionId = background.url().split("/")[2];

    const pageA = await context.newPage();
    await pageA.goto(pageAUrl);
    const pageB = await context.newPage();
    await pageB.goto(pageBUrl);

    await pageA.waitForFunction(() => Boolean(window.AndroidBridge?.postMessage));
    await pageB.waitForFunction(() => Boolean(window.AndroidBridge?.postMessage));

    const tabIdA = await readTabId(background, pageAUrl);
    const tabIdB = await readTabId(background, pageBUrl);

    const panelA = await context.newPage();
    await panelA.goto(`chrome-extension://${extensionId}/panel.html?tabId=${tabIdA}`);
    const panelB = await context.newPage();
    await panelB.goto(`chrome-extension://${extensionId}/panel.html?tabId=${tabIdB}`);

    await openCameraSuccessResponse(panelA);
    await openCameraSuccessResponse(panelB);

    const syncPayloadText = JSON.stringify(
      {
        success: true,
        uri: "mock://camera/sync-updated.jpg",
        data: "sync-check-before-image",
      },
      null,
      2,
    );

    await overwriteResponseJson(panelA, syncPayloadText);
    await saveResponse(panelA);
    await panelB.waitForFunction(
      () => document.querySelector("textarea")?.value.includes("sync-updated.jpg") ?? false,
    );

    const initialSyncedResponse = await triggerBridgeCall(pageB);
    assert(
      initialSyncedResponse.uri === "mock://camera/sync-updated.jpg",
      `Expected synced uri, got ${JSON.stringify(initialSyncedResponse)}`,
    );

    await writeImageWithTool(panelA, fixturePath, "base64", "data");
    const base64Json = await readResponseJson(panelA);
    const base64Payload = JSON.parse(base64Json);
    assert(
      typeof base64Payload.data === "string" && base64Payload.data.length > 20,
      "Expected base64 payload to be written into data field.",
    );

    await writeImageWithTool(panelA, fixturePath, "androidUri", "uri");
    await saveResponse(panelA);
    await panelB.waitForFunction(
      () =>
        document
          .querySelector("textarea")
          ?.value.includes("mock://selected-image/e2e-fixture.png") ?? false,
    );

    const finalResponse = await triggerBridgeCall(pageB);
    assert(
      finalResponse.uri === "mock://selected-image/e2e-fixture.png",
      `Expected final uri from image tool, got ${JSON.stringify(finalResponse)}`,
    );
    assert(
      typeof finalResponse.data === "string" && finalResponse.data.length > 20,
      "Expected final response to include updated base64 data.",
    );

    console.log(
      JSON.stringify(
        {
          status: "success",
          extensionId,
          origin,
          tabIdA,
          tabIdB,
          checks: [
            "panel-b-received-snapshot-update",
            "page-b-received-updated-response-without-reload",
            "image-tool-wrote-base64",
            "image-tool-wrote-android-uri",
          ],
          finalResponse,
        },
        null,
        2,
      ),
    );
  } finally {
    await context.close();
  }
} finally {
  server.close();
  await rm(tempRoot, { recursive: true, force: true });
}

function renderBridgePage() {
  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <title>Bridge E2E</title>
  </head>
  <body>
    <h1 id="title">Bridge E2E</h1>
    <pre id="last-response">(waiting)</pre>
    <script>
      window.__bridgeEvents = [];
      window.addEventListener("openCamera", (event) => {
        window.__bridgeEvents.push(event.detail);
        document.getElementById("last-response").textContent = JSON.stringify(event.detail);
      });
      window.sendBridgeCall = (eventName = "openCamera") => {
        window.AndroidBridge.postMessage(JSON.stringify({ event: eventName }));
      };
      window.readLastBridgeResponse = () => {
        const last = window.__bridgeEvents[window.__bridgeEvents.length - 1];
        return last ? JSON.parse(JSON.stringify(last)) : null;
      };
    </script>
  </body>
</html>`;
}

async function listen(server) {
  await new Promise((resolvePromise, rejectPromise) => {
    server.listen(0, "127.0.0.1", resolvePromise);
    server.on("error", rejectPromise);
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to read server address.");
  }
  return address.port;
}

async function waitForExtensionServiceWorker(context) {
  const existing = context.serviceWorkers().find((worker) =>
    worker.url().includes("/background/serviceWorker.js"),
  );
  if (existing) {
    return existing;
  }

  return await context.waitForEvent("serviceworker", {
    predicate: (worker) => worker.url().includes("/background/serviceWorker.js"),
    timeout: 30000,
  });
}

async function readTabId(worker, url) {
  const tabs = await worker.evaluate(async ({ targetUrl }) => {
    return await new Promise((resolvePromise) => {
      chrome.tabs.query({ url: `${new URL(targetUrl).origin}/*` }, (items) => {
        resolvePromise(
          items
            .filter((item) => item.url === targetUrl)
            .map((item) => ({ id: item.id, url: item.url })),
        );
      });
    });
  }, { targetUrl: url });

  const tabId = tabs[0]?.id;
  if (typeof tabId !== "number") {
    throw new Error(`Failed to resolve tab id for ${url}.`);
  }
  return tabId;
}

async function openCameraSuccessResponse(panelPage) {
  await panelPage.getByText("响应", { exact: true }).click();
  await panelPage
    .getByPlaceholder("按响应名、发送名或事件名搜索")
    .fill("openCamera");
  await panelPage.getByText("相机成功", { exact: true }).click();
  await panelPage.waitForFunction(
    () => document.querySelector("textarea")?.value.includes('"uri"') ?? false,
  );
}

async function overwriteResponseJson(panelPage, text) {
  await panelPage.locator("textarea").fill(text);
}

async function saveResponse(panelPage) {
  await panelPage.getByText("保存响应", { exact: true }).click();
  await panelPage.waitForFunction(
    () => document.body.textContent?.includes("响应已保存") ?? false,
  );
}

async function readResponseJson(panelPage) {
  return await panelPage.locator("textarea").inputValue();
}

async function writeImageWithTool(panelPage, fixturePath, format, fieldPath) {
  const addFieldButton = panelPage.getByText("添加图片字段", { exact: true });
  if ((await addFieldButton.count()) > 0) {
    await addFieldButton.click();
  }
  await panelPage.waitForFunction(
    () => document.body.textContent?.includes("图片格式") ?? false,
  );
  await panelPage
    .locator("label.form-field")
    .filter({ hasText: "图片格式" })
    .locator("select")
    .selectOption(format);
  await panelPage
    .locator("label.form-field")
    .filter({ hasText: "图片字段" })
    .locator('input[list^="image-field-"]')
    .fill(fieldPath);
  await panelPage
    .locator("label.form-field")
    .filter({ hasText: "选择图片" })
    .locator('input[type="file"]')
    .setInputFiles(fixturePath);
  await panelPage.getByText("插入图片", { exact: true }).click();
  await panelPage.waitForFunction(
    (expectedText) =>
      document.body.textContent?.includes(expectedText) ?? false,
    `已写入${format === "base64" ? "Base64" : "模拟 Android URI"}`,
  );
}

async function triggerBridgeCall(page) {
  await page.evaluate(() => {
    document.getElementById("last-response").textContent = "(waiting)";
    window.sendBridgeCall("openCamera");
  });
  await page.waitForFunction(
    () => document.getElementById("last-response")?.textContent !== "(waiting)",
  );
  return await page.evaluate(() => window.readLastBridgeResponse());
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
