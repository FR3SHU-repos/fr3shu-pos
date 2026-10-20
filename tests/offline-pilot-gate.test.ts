import { describe, expect, it } from "vitest";
import { offlinePilotStatus, type OfflinePilotConfig } from "@/shared/lib/offline/pilot-gate";

const base: OfflinePilotConfig = {
  enabled: true,
  orgIds: ["org-1"],
  locationIds: ["loc-1"],
  registerIds: ["register-1"],
  terminalIds: ["terminal-1"],
};

const context = { orgId: "org-1", locationId: "loc-1", registerId: "register-1", terminalId: "terminal-1" };

describe("offline pilot gate", () => {
  it("requires explicit enablement", () => {
    expect(offlinePilotStatus(context, { ...base, enabled: false }).enabled).toBe(false);
  });
  it("allows only the configured terminal and register scope", () => {
    expect(offlinePilotStatus(context, base)).toEqual({ enabled: true });
    expect(offlinePilotStatus({ ...context, terminalId: "other" }, base).reason).toContain("terminal");
    expect(offlinePilotStatus({ ...context, registerId: "other" }, base).reason).toContain("register");
  });
  it("supports broader organization-only pilots", () => {
    expect(offlinePilotStatus({ orgId: "org-1", locationId: "loc-9" }, { ...base, locationIds: [], registerIds: [], terminalIds: [] })).toEqual({ enabled: true });
  });
});
