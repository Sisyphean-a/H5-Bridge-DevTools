import { bootstrapContentScript } from "./controller";

const contentScriptScope = globalThis as typeof globalThis & {
  __H5_BRIDGE_CONTENT_BOOTSTRAPPED__?: boolean;
};

if (!contentScriptScope.__H5_BRIDGE_CONTENT_BOOTSTRAPPED__) {
  contentScriptScope.__H5_BRIDGE_CONTENT_BOOTSTRAPPED__ = true;
  bootstrapContentScript();
}
