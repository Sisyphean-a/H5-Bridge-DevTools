export type BridgeProfileId = "pkg01" | "pkg03";

export interface BridgeProfile {
  id: BridgeProfileId;
  title: string;
  badge: string;
  description: string;
  hostObject: string;
  outgoingField: string;
  incomingField: string;
  resultNote: string;
}

export const DEFAULT_BRIDGE_PROFILE_ID: BridgeProfileId = "pkg01";

export const BRIDGE_PROFILES: readonly BridgeProfile[] = [
  {
    id: "pkg01",
    title: "01 包",
    badge: "01",
    description: "沿用 AndroidBridge / h5Json / dataJson 的桥接口径。",
    hostObject: "AndroidBridge",
    outgoingField: "h5Json",
    incomingField: "dataJson",
    resultNote: "大多数回包看 success，uploadBigJson 兼容字符串布尔值。",
  },
  {
    id: "pkg03",
    title: "03 包",
    badge: "03",
    description: "使用 solvivaScope / jsData / AndroidData 的独立协议。",
    hostObject: "solvivaScope",
    outgoingField: "jsData",
    incomingField: "AndroidData",
    resultNote: "多数回包看 result，通讯录单独使用 success。",
  },
] as const;

const bridgeProfilesById = Object.fromEntries(
  BRIDGE_PROFILES.map((profile) => [profile.id, profile]),
) as Record<BridgeProfileId, BridgeProfile>;

export function isBridgeProfileId(value: unknown): value is BridgeProfileId {
  return value === "pkg01" || value === "pkg03";
}

export function getBridgeProfile(
  profileId: BridgeProfileId | string | undefined,
): BridgeProfile {
  return isBridgeProfileId(profileId)
    ? bridgeProfilesById[profileId]
    : bridgeProfilesById[DEFAULT_BRIDGE_PROFILE_ID];
}

export function listBridgeProfiles(): readonly BridgeProfile[] {
  return BRIDGE_PROFILES;
}
