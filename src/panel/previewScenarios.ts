export function runPreviewScenario(): void {
  const scenario = new URLSearchParams(window.location.search).get("scenario");
  if (!scenario) {
    return;
  }

  void applyScenario(scenario);
}

async function applyScenario(scenario: string): Promise<void> {
  switch (scenario) {
    case "responses":
      await clickText(".subtab-button", "响应");
      break;
    case "matches":
      await clickText(".subtab-button", "匹配");
      break;
    case "sender-detail":
      await clickText(".row-card", "登录");
      break;
    case "response-detail":
      await clickText(".subtab-button", "响应");
      await clickText(".row-card", "登录成功");
      break;
    case "match-close":
      await clickText(".subtab-button", "匹配");
      await clickText(".control-button", "关闭配对");
      break;
  }
}

async function clickText(selector: string, text: string): Promise<void> {
  const target = await waitForMatch(selector, text);
  if (!target) {
    return;
  }
  target.click();
  await nextFrame();
}

function waitForMatch(selector: string, text: string): Promise<HTMLElement | null> {
  const existing = findMatch(selector, text);
  if (existing) {
    return Promise.resolve(existing);
  }

  return new Promise((resolve) => {
    const timeoutId = window.setTimeout(() => {
      observer.disconnect();
      resolve(findMatch(selector, text));
    }, 1500);

    const observer = new MutationObserver(() => {
      const target = findMatch(selector, text);
      if (!target) {
        return;
      }
      window.clearTimeout(timeoutId);
      observer.disconnect();
      resolve(target);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  });
}

function findMatch(selector: string, text: string): HTMLElement | null {
  const nodes = Array.from(document.querySelectorAll<HTMLElement>(selector));
  return (
    nodes.find((node) => node.innerText.trim().startsWith(text)) ??
    nodes.find((node) => node.innerText.includes(text)) ??
    null
  );
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => window.requestAnimationFrame(() => resolve()));
}
