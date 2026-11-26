import { describe, expect, it } from "vitest";
import { addDays, isIsoDay, istDateTime, istDay, istDayStart } from "./time";

describe("IST time", () => {
  it("rolls the day over at IST midnight, not UTC", () => {
    expect(istDay(new Date("2026-11-25T18:29:00Z"))).toBe("2026-11-25");
    expect(istDay(new Date("2026-11-25T18:30:00Z"))).toBe("2026-11-26");
  });

  it("converts IST wall time to UTC", () => {
    expect(istDayStart("2026-11-26").toISOString()).toBe("2026-11-25T18:30:00.000Z");
    expect(istDateTime("2026-11-26", "10:15").toISOString()).toBe("2026-11-26T04:45:00.000Z");
  });

  it("validates and adds days", () => {
    expect(isIsoDay("2026-02-30")).toBe(false);
    expect(isIsoDay("2026-11-26")).toBe(true);
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
  });
});
