/**
 * Follow-up dates are set by the practitioner. CareQueue only reminds; it never decides when a
 * patient should come back.
 */
import { addDays, istDay, type IsoDay } from "./time";

export const FOLLOWUP_MAX_DAYS = 365;
/** Send the reminder this many days before the due date (and on any later day until booked). */
export const REMIND_DAYS_BEFORE = 2;

export type FollowUpStatus = "scheduled" | "reminded" | "returned" | "cancelled";

export function validateFollowUpDate(due: IsoDay, now: Date): string | null {
  const today = istDay(now);
  if (due <= today) return "Follow-up date must be after today";
  if (due > addDays(today, FOLLOWUP_MAX_DAYS)) return "Follow-up date must be within a year";
  return null;
}

/** A scheduled follow-up is due for a reminder from REMIND_DAYS_BEFORE days before its date. */
export function isReminderDue(f: { status: FollowUpStatus; dueDate: IsoDay }, now: Date): boolean {
  if (f.status !== "scheduled") return false;
  return istDay(now) >= addDays(f.dueDate, -REMIND_DAYS_BEFORE);
}
