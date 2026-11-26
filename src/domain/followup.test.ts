import { describe, expect, it } from "vitest";
import { isReminderDue, validateFollowUpDate } from "./followup";

const now = new Date("2026-11-25T06:00:00Z");

describe("follow-ups", () => {
  it("must be in the future and within a year", () => {
    expect(validateFollowUpDate("2026-11-25", now)).toMatch(/after today/);
    expect(validateFollowUpDate("2026-12-02", now)).toBeNull();
    expect(validateFollowUpDate("2028-01-01", now)).toMatch(/within a year/);
  });

  it("is due for a reminder two days before", () => {
    expect(isReminderDue({ status: "scheduled", dueDate: "2026-11-27" }, now)).toBe(true);
    expect(isReminderDue({ status: "scheduled", dueDate: "2026-11-28" }, now)).toBe(false);
    expect(isReminderDue({ status: "reminded", dueDate: "2026-11-26" }, now)).toBe(false);
  });
});
