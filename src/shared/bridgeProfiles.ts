export type BridgeProfileId = string;

export interface BridgeProfile {
  id: BridgeProfileId;
  title: string;
  hostObject: string;
  /** Parsed bridge requests read their matching event from this top-level field. */
  requestEventField?: string;
}

export const DEFAULT_BRIDGE_PROFILE_ID = "pkg01";
export const DEFAULT_REQUEST_EVENT_FIELD = "event";

/** Built-in profiles preserve existing saved rules; imported rule packages may add more. */
export const BRIDGE_PROFILES: readonly BridgeProfile[] = [
  {
    id: "pkg01",
    title: "01 包",
    hostObject: "AndroidBridge",
    requestEventField: DEFAULT_REQUEST_EVENT_FIELD,
  },
  {
    id: "pkg03",
    title: "03 包",
    hostObject: "solvivaScope",
    requestEventField: DEFAULT_REQUEST_EVENT_FIELD,
  },
];

const bridgeProfilesById = new Map(BRIDGE_PROFILES.map((profile) => [profile.id, profile]));
const profileIdPattern = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const hostObjectPattern = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
const requestEventFieldPattern = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
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

export function normalizeBridgeProfile(value: unknown): BridgeProfile | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const id = Reflect.get(value, "id");
  const title = Reflect.get(value, "title");
  const hostObject = Reflect.get(value, "hostObject");
  const requestEventField = Reflect.get(value, "requestEventField");
  if (
    typeof id !== "string" ||
    !profileIdPattern.test(id) ||
    typeof title !== "string" ||
    title.trim().length === 0 ||
    title.trim().length > 80 ||
    typeof hostObject !== "string" ||
    !isBridgeHostObjectName(hostObject) ||
    (requestEventField !== undefined &&
      (typeof requestEventField !== "string" || !isBridgeRequestEventFieldName(requestEventField)))
  ) {
    return undefined;
  }

  return {
    id,
    title: title.trim(),
    hostObject,
    requestEventField: requestEventField ?? DEFAULT_REQUEST_EVENT_FIELD,
  };
}

export function isBridgeProfile(value: unknown): value is BridgeProfile {
  return normalizeBridgeProfile(value) !== undefined;
}

export function isBridgeHostObjectName(value: string): boolean {
  return hostObjectPattern.test(value) && !unsafeHostObjects.has(value);
}

export function isBridgeRequestEventFieldName(value: string): boolean {
  return requestEventFieldPattern.test(value) && !unsafeHostObjects.has(value);
}

export function getRequestEventField(profile: BridgeProfile): string {
  return profile.requestEventField ?? DEFAULT_REQUEST_EVENT_FIELD;
}

export function listBridgeProfiles(): readonly BridgeProfile[] {
  return BRIDGE_PROFILES;
}
