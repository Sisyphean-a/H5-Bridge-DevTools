export type BridgeProfileId = string;

export interface BridgeProfile {
  id: BridgeProfileId;
  title: string;
  hostObject: string;
}

export const DEFAULT_BRIDGE_PROFILE_ID = "pkg01";

/** Built-in profiles preserve existing saved rules; imported rule packages may add more. */
export const BRIDGE_PROFILES: readonly BridgeProfile[] = [
  { id: "pkg01", title: "01 包", hostObject: "AndroidBridge" },
  { id: "pkg03", title: "03 包", hostObject: "solvivaScope" },
];

const bridgeProfilesById = new Map(BRIDGE_PROFILES.map((profile) => [profile.id, profile]));
const profileIdPattern = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const hostObjectPattern = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
const unsafeHostObjects = new Set([
  "__proto__",
  "constructor",
  "prototype",
  "window",
  "self",
  "globalThis",
  "top",
  "parent",
  "frames",
  "location",
  "document",
  "history",
  "navigator",
  "localStorage",
  "sessionStorage",
  "undefined",
  "NaN",
  "Infinity",
  "alert",
  "confirm",
  "prompt",
  "postMessage",
  "close",
  "open",
  "print",
  "stop",
  "focus",
  "blur",
  "setTimeout",
  "clearTimeout",
  "setInterval",
  "clearInterval",
  "requestAnimationFrame",
  "cancelAnimationFrame",
  "fetch",
]);

export function getBridgeProfile(profileId: string | undefined): BridgeProfile {
  return bridgeProfilesById.get(profileId ?? "") ?? bridgeProfilesById.get(DEFAULT_BRIDGE_PROFILE_ID)!;
}

export function getBuiltInBridgeProfile(profileId: string): BridgeProfile | undefined {
  return bridgeProfilesById.get(profileId);
}

export function isBridgeProfile(value: unknown): value is BridgeProfile {
  if (!value || typeof value !== "object") {
    return false;
  }

  const id = Reflect.get(value, "id");
  const title = Reflect.get(value, "title");
  const hostObject = Reflect.get(value, "hostObject");
  return (
    typeof id === "string" &&
    profileIdPattern.test(id) &&
    typeof title === "string" &&
    title.trim().length > 0 &&
    title.trim().length <= 80 &&
    typeof hostObject === "string" &&
    isBridgeHostObjectName(hostObject)
  );
}

export function isBridgeHostObjectName(value: string): boolean {
  return hostObjectPattern.test(value) && !unsafeHostObjects.has(value);
}

export function listBridgeProfiles(): readonly BridgeProfile[] {
  return BRIDGE_PROFILES;
}
