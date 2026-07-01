export {};

declare global {
  interface BridgePostMessageHost {
    postMessage: (message: unknown) => void;
  }

  interface Window {
    AndroidBridge?: BridgePostMessageHost;
    solvivaScope?: BridgePostMessageHost;
    __H5_BRIDGE_INJECT_MAIN_INSTALLED__?: boolean;
    __H5_BRIDGE_ORIGINAL_BRIDGES__?: Partial<
      Record<string, BridgePostMessageHost>
    >;
  }
}
