import { describe, expect, it } from "vitest";
import { CONSENT_OPTIONS, consentChanges, currentConsent } from "./consent";

describe("consent", () => {
  it("defaults to nothing granted", () => {
    expect(currentConsent([])).toEqual({ service: false, reminders: false, marketing: false });
  });

  it("uses the latest record per purpose", () => {
    const state = currentConsent([
      { purpose: "marketing", granted: true, at: new Date("2026-11-01T00:00:00Z") },
      { purpose: "marketing", granted: false, at: new Date("2026-11-02T00:00:00Z") },
      { purpose: "service", granted: true, at: new Date("2026-11-01T00:00:00Z") },
    ]);
    expect(state).toEqual({ service: true, reminders: false, marketing: false });
  });

  it("lists only changed purposes", () => {
    expect(consentChanges({ service: true, reminders: false, marketing: false }, { service: true, reminders: true })).toEqual([
      { purpose: "reminders", granted: true },
    ]);
  });

  it("has three separate choices and only service is required", () => {
    expect(CONSENT_OPTIONS.map((o) => o.purpose)).toEqual(["service", "reminders", "marketing"]);
    expect(CONSENT_OPTIONS.filter((o) => o.required).map((o) => o.purpose)).toEqual(["service"]);
  });
});
