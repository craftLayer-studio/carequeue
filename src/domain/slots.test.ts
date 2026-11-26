import { describe, expect, it } from "vitest";
import { bookableDays, isBookable, parseSessions, slotsFor, type DoctorSchedule } from "./slots";
import { istDateTime } from "./time";

const schedule: DoctorSchedule = { sessions: "10:00-11:00,17:00-17:30", slotMinutes: 15, weeklyOff: 0 };
// Tuesday 25 Nov 2026, 09:00 IST
const now = istDateTime("2026-11-25", "09:00");

describe("sessions", () => {
  it("parses and sorts sessions", () => {
    expect(parseSessions("17:00-20:00, 10:00-13:00")).toEqual([
      { start: 600, end: 780 },
      { start: 1020, end: 1200 },
    ]);
  });

  it("rejects bad or overlapping sessions", () => {
    expect(() => parseSessions("13:00-10:00")).toThrow();
    expect(() => parseSessions("10:00-13:00,12:00-14:00")).toThrow(/overlap/);
    expect(() => parseSessions("")).toThrow();
  });
});

describe("slots", () => {
  it("lists slots in each session", () => {
    const s = slotsFor(schedule, "2026-11-26", [], now);
    expect(s.map((x) => x.time)).toEqual(["10:00", "10:15", "10:30", "10:45", "17:00", "17:15"]);
    expect(s.every((x) => x.available)).toBe(true);
  });

  it("marks booked and too-soon slots unavailable", () => {
    const booked = [istDateTime("2026-11-25", "10:30")];
    const s = slotsFor(schedule, "2026-11-25", booked, istDateTime("2026-11-25", "10:05"));
    expect(s.filter((x) => x.available).map((x) => x.time)).toEqual(["10:45", "17:00", "17:15"]);
  });

  it("skips the weekly day off", () => {
    expect(slotsFor(schedule, "2026-11-29", [], now)).toEqual([]);
    expect(bookableDays(schedule, now)).not.toContain("2026-11-29");
    expect(bookableDays(schedule, now)[0]).toBe("2026-11-25");
  });

  it("checks a requested slot exactly", () => {
    expect(isBookable(schedule, istDateTime("2026-11-26", "10:15"), [], now)).toBe(true);
    expect(isBookable(schedule, istDateTime("2026-11-26", "10:20"), [], now)).toBe(false);
    expect(isBookable(schedule, istDateTime("2026-12-25", "10:15"), [], now)).toBe(false);
  });
});
