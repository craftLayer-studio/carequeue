/**
 * Owner dashboard numbers: patients per day, average wait, no-shows, collections.
 */
import type { Paise } from "./money";
import type { TokenStatus } from "./queue";
import { istDay, type IsoDay } from "./time";

export interface TokenFact {
  status: TokenStatus;
  joinedAt: Date;
  calledAt: Date | null;
}

export interface AppointmentFact {
  status: "booked" | "checked_in" | "cancelled" | "no_show";
  startsAt: Date;
}

export interface PaymentFact {
  status: "pending" | "paid";
  method: "upi" | "cash";
  amount: Paise;
  paidAt: Date | null;
}

export interface DaySummary {
  day: IsoDay;
  patients: number;
  seen: number;
  noShows: number;
  avgWaitMin: number | null;
  collectedUpi: Paise;
  collectedCash: Paise;
}

function emptyDay(day: IsoDay): DaySummary {
  return { day, patients: 0, seen: 0, noShows: 0, avgWaitMin: null, collectedUpi: 0, collectedCash: 0 };
}

/**
 * Summarise facts into one row per day in `days`. A no-show is a token marked no-show or a booked
 * appointment marked no-show. Average wait is joined-to-called minutes over called tokens.
 */
export function summarizeDays(
  days: readonly IsoDay[],
  facts: { tokens: readonly TokenFact[]; appointments: readonly AppointmentFact[]; payments: readonly PaymentFact[] },
): DaySummary[] {
  const rows = new Map(days.map((d) => [d, emptyDay(d)]));
  const waits = new Map<IsoDay, number[]>();

  for (const t of facts.tokens) {
    const row = rows.get(istDay(t.joinedAt));
    if (!row || t.status === "cancelled") continue;
    row.patients += 1;
    if (t.status === "done") row.seen += 1;
    if (t.status === "no_show") row.noShows += 1;
    if (t.calledAt) {
      const list = waits.get(row.day) ?? [];
      list.push((t.calledAt.getTime() - t.joinedAt.getTime()) / 60_000);
      waits.set(row.day, list);
    }
  }
  for (const a of facts.appointments) {
    const row = rows.get(istDay(a.startsAt));
    if (row && a.status === "no_show") row.noShows += 1;
  }
  for (const p of facts.payments) {
    if (p.status !== "paid" || !p.paidAt) continue;
    const row = rows.get(istDay(p.paidAt));
    if (!row) continue;
    if (p.method === "upi") row.collectedUpi += p.amount;
    else row.collectedCash += p.amount;
  }
  for (const [day, list] of waits) {
    const row = rows.get(day)!;
    row.avgWaitMin = Math.round(list.reduce((s, n) => s + Math.max(0, n), 0) / list.length);
  }
  return days.map((d) => rows.get(d)!);
}

export interface PeriodTotals {
  patients: number;
  seen: number;
  noShows: number;
  noShowRate: number;
  avgWaitMin: number | null;
  collected: Paise;
}

export function totals(rows: readonly DaySummary[]): PeriodTotals {
  const patients = rows.reduce((s, r) => s + r.patients, 0);
  const seen = rows.reduce((s, r) => s + r.seen, 0);
  const noShows = rows.reduce((s, r) => s + r.noShows, 0);
  const withWait = rows.filter((r) => r.avgWaitMin !== null && r.patients > 0);
  const weight = withWait.reduce((s, r) => s + r.patients, 0);
  const avgWaitMin = weight === 0 ? null : Math.round(withWait.reduce((s, r) => s + r.avgWaitMin! * r.patients, 0) / weight);
  return {
    patients,
    seen,
    noShows,
    noShowRate: patients === 0 ? 0 : Math.round((noShows / patients) * 100),
    avgWaitMin,
    collected: rows.reduce((s, r) => s + r.collectedUpi + r.collectedCash, 0),
  };
}
