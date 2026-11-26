/**
 * Appointment slots per doctor. A doctor has one or two daily sessions ("10:00-13:00,17:00-20:00"),
 * a slot length and an optional weekly day off. All times are IST.
 */
import { addDays, formatHhmm, istDateTime, istDay, parseHhmm, type IsoDay } from "./time";

export const BOOKING_DAYS_AHEAD = 14;
/** Patients cannot book a slot starting sooner than this. */
export const MIN_LEAD_MINUTES = 15;

export interface Session {
  start: number;
  end: number;
}

export interface DoctorSchedule {
  sessions: string;
  slotMinutes: number;
  /** 0 = Sunday … 6 = Saturday; null = open every day. */
  weeklyOff: number | null;
}

export function parseSessions(spec: string): Session[] {
  const parts = spec
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length === 0 || parts.length > 3) throw new Error("Give one to three sessions, e.g. 10:00-13:00");
  const sessions = parts.map((p) => {
    const [a, b] = p.split("-");
    if (!a || !b) throw new Error(`Invalid session ${p}`);
    const start = parseHhmm(a.trim());
    const end = parseHhmm(b.trim());
    if (end <= start) throw new Error(`Session ${p} must end after it starts`);
    return { start, end };
  });
  sessions.sort((x, y) => x.start - y.start);
  for (let i = 1; i < sessions.length; i++) {
    if (sessions[i].start < sessions[i - 1].end) throw new Error("Sessions overlap");
  }
  return sessions;
}

export function isValidSessions(spec: string): boolean {
  try {
    parseSessions(spec);
    return true;
  } catch {
    return false;
  }
}

function weekday(day: IsoDay): number {
  return new Date(`${day}T00:00:00Z`).getUTCDay();
}

export function isOpenOn(schedule: DoctorSchedule, day: IsoDay): boolean {
  return schedule.weeklyOff === null || weekday(day) !== schedule.weeklyOff;
}

/** Days a patient may book, from today (IST) for BOOKING_DAYS_AHEAD days, skipping days off. */
export function bookableDays(schedule: DoctorSchedule, now: Date): IsoDay[] {
  const today = istDay(now);
  const out: IsoDay[] = [];
  for (let i = 0; i < BOOKING_DAYS_AHEAD; i++) {
    const d = addDays(today, i);
    if (isOpenOn(schedule, d)) out.push(d);
  }
  return out;
}

export interface Slot {
  time: string;
  startsAt: Date;
  available: boolean;
}

/** All slots for a day with availability, given already-booked start instants. */
export function slotsFor(schedule: DoctorSchedule, day: IsoDay, booked: readonly Date[], now: Date): Slot[] {
  if (!isOpenOn(schedule, day)) return [];
  const taken = new Set(booked.map((d) => d.getTime()));
  const earliest = now.getTime() + MIN_LEAD_MINUTES * 60_000;
  const out: Slot[] = [];
  for (const s of parseSessions(schedule.sessions)) {
    for (let m = s.start; m + schedule.slotMinutes <= s.end; m += schedule.slotMinutes) {
      const time = formatHhmm(m);
      const startsAt = istDateTime(day, time);
      out.push({ time, startsAt, available: !taken.has(startsAt.getTime()) && startsAt.getTime() >= earliest });
    }
  }
  return out;
}

/** True if `startsAt` is an exact, bookable, free slot. */
export function isBookable(schedule: DoctorSchedule, startsAt: Date, booked: readonly Date[], now: Date): boolean {
  const day = istDay(startsAt);
  if (!bookableDays(schedule, now).includes(day)) return false;
  return slotsFor(schedule, day, booked, now).some((s) => s.available && s.startsAt.getTime() === startsAt.getTime());
}
