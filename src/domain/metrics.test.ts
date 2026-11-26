import { describe, expect, it } from "vitest";
import { summarizeDays, totals } from "./metrics";

const d = (iso: string) => new Date(iso);

describe("dashboard metrics", () => {
  const rows = summarizeDays(["2026-11-24", "2026-11-25"], {
    tokens: [
      { status: "done", joinedAt: d("2026-11-25T04:00:00Z"), calledAt: d("2026-11-25T04:20:00Z") },
      { status: "done", joinedAt: d("2026-11-25T04:10:00Z"), calledAt: d("2026-11-25T04:40:00Z") },
      { status: "no_show", joinedAt: d("2026-11-25T05:00:00Z"), calledAt: null },
      { status: "cancelled", joinedAt: d("2026-11-25T05:00:00Z"), calledAt: null },
      { status: "done", joinedAt: d("2026-11-24T04:00:00Z"), calledAt: d("2026-11-24T04:10:00Z") },
    ],
    appointments: [{ status: "no_show", startsAt: d("2026-11-24T05:00:00Z") }],
    payments: [
      { status: "paid", method: "upi", amount: 50000, paidAt: d("2026-11-25T05:00:00Z") },
      { status: "paid", method: "cash", amount: 30000, paidAt: d("2026-11-25T05:00:00Z") },
      { status: "pending", method: "upi", amount: 50000, paidAt: null },
    ],
  });

  it("summarises each day", () => {
    expect(rows[1]).toEqual({ day: "2026-11-25", patients: 3, seen: 2, noShows: 1, avgWaitMin: 25, collectedUpi: 50000, collectedCash: 30000 });
    expect(rows[0]).toMatchObject({ patients: 1, noShows: 1, avgWaitMin: 10 });
  });

  it("totals a period", () => {
    expect(totals(rows)).toEqual({ patients: 4, seen: 3, noShows: 2, noShowRate: 50, avgWaitMin: 21, collected: 80000 });
  });

  it("handles empty days", () => {
    expect(totals(summarizeDays(["2026-11-20"], { tokens: [], appointments: [], payments: [] }))).toMatchObject({ patients: 0, avgWaitMin: null, noShowRate: 0 });
  });
});
