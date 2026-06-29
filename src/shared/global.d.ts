export {};

declare global {
  interface Window {
    AndroidBridge?: {
      postMessage: (message: unknown) => void;
    };
    __H5_BRIDGE_INJECT_MAIN_INSTALLED__?: boolean;
    __H5_BRIDGE_ORIGINAL_ANDROID_BRIDGE__?: {
      postMessage: (message: unknown) => void;
    };
  }
}
