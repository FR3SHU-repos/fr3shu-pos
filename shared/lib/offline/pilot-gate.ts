export interface OfflinePilotContext {
  orgId: string;
  locationId: string;
  registerId?: string;
  terminalId?: string;
}

export interface OfflinePilotConfig {
  enabled: boolean;
  orgIds: string[];
  locationIds: string[];
  registerIds: string[];
  terminalIds: string[];
}

export interface OfflinePilotStatus {
  enabled: boolean;
  reason?: string;
}

function csv(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

/** Public build-time configuration; never put credentials in these values. */
export function offlinePilotConfigFromEnv(): OfflinePilotConfig {
  return {
    // Tests can exercise the local repository without requiring a deployment
    // environment variable. Real builds stay disabled unless explicitly
    // enabled for a pilot.
    enabled: process.env.NEXT_PUBLIC_OFFLINE_POS_PILOT_ENABLED === "true" || process.env.NODE_ENV === "test",
    orgIds: csv(process.env.NEXT_PUBLIC_OFFLINE_POS_PILOT_ORG_IDS),
    locationIds: csv(process.env.NEXT_PUBLIC_OFFLINE_POS_PILOT_LOCATION_IDS),
    registerIds: csv(process.env.NEXT_PUBLIC_OFFLINE_POS_PILOT_REGISTER_IDS),
    terminalIds: csv(process.env.NEXT_PUBLIC_OFFLINE_POS_PILOT_TERMINAL_IDS),
  };
}

export function offlinePilotStatus(
  context: OfflinePilotContext,
  config = offlinePilotConfigFromEnv(),
): OfflinePilotStatus {
  if (!config.enabled) return { enabled: false, reason: "Offline sales are not enabled for this terminal pilot." };
  if (config.orgIds.length > 0 && !config.orgIds.includes(context.orgId)) {
    return { enabled: false, reason: "This organization is not included in the offline pilot." };
  }
  if (config.locationIds.length > 0 && !config.locationIds.includes(context.locationId)) {
    return { enabled: false, reason: "This location is not included in the offline pilot." };
  }
  if (config.registerIds.length > 0 && (!context.registerId || !config.registerIds.includes(context.registerId))) {
    return { enabled: false, reason: "This register is not included in the offline pilot." };
  }
  if (config.terminalIds.length > 0 && (!context.terminalId || !config.terminalIds.includes(context.terminalId))) {
    return { enabled: false, reason: "This terminal is not included in the offline pilot." };
  }
  return { enabled: true };
}
