/**
 * Time helpers. Instants are stored as UTC; clinic days and display use India Standard Time
 * (UTC+5:30 all year, no daylight saving).
 */
export const IST_OFFSET_MINUTES = 330;
const OFFSET_MS = IST_OFFSET_MINUTES * 60_000;
export const MINUTE_MS = 60_000;
export const DAY_MS = 86_400_000;

/** A clinic calendar day in IST, formatted `YYYY-MM-DD`. */
export type IsoDay = string;

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDay(value: string): value is IsoDay {
  if (!DAY_RE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/** IST calendar day for an instant. */
export function istDay(at: Date | number): IsoDay {
  const ms = typeof at === "number" ? at : at.getTime();
  return new Date(ms + OFFSET_MS).toISOString().slice(0, 10);
}

/** UTC instant of IST midnight at the start of `day`. */
export function istDayStart(day: IsoDay): Date {
  return new Date(Date.parse(`${day}T00:00:00Z`) - OFFSET_MS);
}

/** UTC instant for `HH:MM` IST on `day`. */
export function istDateTime(day: IsoDay, hhmm: string): Date {
  const minutes = parseHhmm(hhmm);
  return new Date(istDayStart(day).getTime() + minutes * MINUTE_MS);
}

export function addDays(day: IsoDay, days: number): IsoDay {
  return new Date(Date.parse(`${day}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

/** Minutes after midnight for `HH:MM` (24-hour). Throws on bad input. */
export function parseHhmm(hhmm: string): number {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hhmm);
  if (!m) throw new Error(`Invalid time ${hhmm}, expected HH:MM`);
  return Number(m[1]) * 60 + Number(m[2]);
}

export function formatHhmm(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Display time in IST, e.g. "10:30 am". */
export function formatIstTime(at: Date | number): string {
  return new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit", hour12: true }).format(
    typeof at === "number" ? new Date(at) : at,
  );
}

/** Display a day, e.g. "Tue, 25 Nov". */
export function formatIstDay(day: IsoDay): string {
  return new Intl.DateTimeFormat("en-IN", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" }).format(
    new Date(`${day}T00:00:00Z`),
  );
}
