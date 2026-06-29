import { beforeEach, describe, expect, it } from "vitest";
import { STORAGE_KEY } from "../shared/constants";
import { createSender } from "../test/factories";
import { loadSnapshotForTab } from "./runtimeBridge";

const origin = "https://example.com";
let storageBucket: Record<string, unknown>;

beforeEach(() => {
  storageBucket = {
    [STORAGE_KEY]: {
      globalEnabled: true,
      origins: {
        [origin]: {
          senders: [createSender("sender-1", { name: "登录发送" })],
          logs: [],
          settings: {
            autoMock: true,
            preserveLogs: false,
            maxLogCount: 200,
            overrideExistingAndroidBridge: true,
          },
        },
      },
    },
  };
  installChromeMock();
});

describe("loadSnapshotForTab", () => {
  it("会按当前 tab URL 读取对应 origin 的快照", async () => {
    const snapshot = await loadSnapshotForTab(7);

    expect(snapshot?.origin).toBe(origin);
    expect(snapshot?.href).toBe(`${origin}/page-a`);
    expect(snapshot?.senders[0]?.name).toBe("登录发送");
  });

  it("tab 没有 URL 时返回 null", async () => {
    chrome.tabs.get = async () => ({ id: 7 } as chrome.tabs.Tab);

    await expect(loadSnapshotForTab(7)).resolves.toBeNull();
  });
});

function installChromeMock(): void {
  (globalThis as typeof globalThis & { chrome: typeof chrome }).chrome = {
    tabs: {
      async get() {
        return {
          id: 7,
          url: `${origin}/page-a`,
        } as chrome.tabs.Tab;
      },
    },
    storage: {
      local: {
        async get(key: string) {
          return { [key]: cloneValue(storageBucket[key]) };
        },
      },
    },
  } as unknown as typeof chrome;
}

function cloneValue<T>(value: T): T {
  return value === undefined ? value : JSON.parse(JSON.stringify(value)) as T;
}
