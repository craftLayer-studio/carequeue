/**
 * Token queue rules: status transitions, ordering, position and live wait estimate.
 * One queue per doctor (counter) per IST day.
 */
import { MINUTE_MS } from "./time";

export const TOKEN_STATUSES = ["waiting", "called", "done", "skipped", "no_show", "cancelled"] as const;
export type TokenStatus = (typeof TOKEN_STATUSES)[number];

export const TOKEN_KINDS = ["walkin", "appointment"] as const;
export type TokenKind = (typeof TOKEN_KINDS)[number];

/** Front-desk priority. Set by staff only (never by the patient), and not a clinical triage score. */
export const PRIORITIES = ["normal", "elderly", "urgent"] as const;
export type Priority = (typeof PRIORITIES)[number];

const PRIORITY_RANK: Record<Priority, number> = { urgent: 0, elderly: 1, normal: 2 };

export type QueueAction = "call" | "done" | "skip" | "requeue" | "no_show" | "cancel";

const TRANSITIONS: Record<QueueAction, { from: readonly TokenStatus[]; to: TokenStatus }> = {
  call: { from: ["waiting", "skipped"], to: "called" },
  done: { from: ["called"], to: "done" },
  skip: { from: ["called", "waiting"], to: "skipped" },
  requeue: { from: ["skipped"], to: "waiting" },
  no_show: { from: ["waiting", "called", "skipped"], to: "no_show" },
  cancel: { from: ["waiting", "skipped"], to: "cancelled" },
};

export class InvalidTransitionError extends Error {
  constructor(
    public readonly from: TokenStatus,
    public readonly action: QueueAction,
  ) {
    super(`Cannot ${action.replace("_", "-")} a token that is ${from.replace("_", " ")}`);
    this.name = "InvalidTransitionError";
  }
}

export function isQueueAction(value: unknown): value is QueueAction {
  return typeof value === "string" && value in TRANSITIONS;
}

/** Next status for an action, or throws InvalidTransitionError. */
export function nextStatus(from: TokenStatus, action: QueueAction): TokenStatus {
  const t = TRANSITIONS[action];
  if (!t.from.includes(from)) throw new InvalidTransitionError(from, action);
  return t.to;
}

export function isTerminal(status: TokenStatus): boolean {
  return status === "done" || status === "no_show" || status === "cancelled";
}

export interface QueueToken {
  id: string;
  number: number;
  status: TokenStatus;
  priority: Priority;
  /** When the token entered (or re-entered) the waiting line. */
  queuedAt: Date;
  calledAt: Date | null;
  doneAt: Date | null;
}

/** Waiting tokens in the order they will be called: priority, then time in line, then number. */
export function waitingOrder<T extends QueueToken>(tokens: readonly T[]): T[] {
  return tokens
    .filter((t) => t.status === "waiting")
    .sort(
      (a, b) =>
        PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
        a.queuedAt.getTime() - b.queuedAt.getTime() ||
        a.number - b.number,
    );
}

/** The token "Call next" picks: the head of the waiting line. */
export function pickNext<T extends QueueToken>(tokens: readonly T[]): T | undefined {
  return waitingOrder(tokens)[0];
}

export const DEFAULT_CONSULT_MIN = 8;
const MIN_CONSULT = 2;
const MAX_CONSULT = 45;
const ROLLING_WINDOW = 10;

/**
 * Rolling average consultation minutes from the last finished consultations today, falling back
 * to the doctor's configured average. Clamped so one outlier does not swing the estimate.
 */
export function averageConsultMinutes(tokens: readonly QueueToken[], fallbackMin = DEFAULT_CONSULT_MIN): number {
  const durations = tokens
    .filter((t) => t.status === "done" && t.calledAt && t.doneAt)
    .sort((a, b) => b.doneAt!.getTime() - a.doneAt!.getTime())
    .slice(0, ROLLING_WINDOW)
    .map((t) => (t.doneAt!.getTime() - t.calledAt!.getTime()) / MINUTE_MS);
  if (durations.length < 3) return clamp(fallbackMin);
  const avg = durations.reduce((s, d) => s + d, 0) / durations.length;
  return clamp(Math.round(avg));
}

function clamp(n: number): number {
  return Math.min(MAX_CONSULT, Math.max(MIN_CONSULT, n));
}

export interface QueuePosition {
  status: TokenStatus;
  /** Patients who will be called before this token (0 = next). Null when not waiting. */
  ahead: number | null;
  /** Estimated minutes until called. Null when not waiting. */
  etaMinutes: number | null;
  /** Number of the token currently with the doctor, if any. */
  nowServing: number | null;
}

/** Position and estimated wait of one token in its queue at time `now`. */
export function positionOf(tokens: readonly QueueToken[], tokenId: string, now: Date, avgMin: number): QueuePosition {
  const token = tokens.find((t) => t.id === tokenId);
  if (!token) throw new Error(`Token ${tokenId} not in queue`);
  const current = tokens
    .filter((t) => t.status === "called")
    .sort((a, b) => (b.calledAt?.getTime() ?? 0) - (a.calledAt?.getTime() ?? 0))[0];
  const nowServing = current?.number ?? null;
  if (token.status !== "waiting") return { status: token.status, ahead: null, etaMinutes: null, nowServing };

  const order = waitingOrder(tokens);
  const ahead = order.findIndex((t) => t.id === tokenId);
  let remainingCurrent = 0;
  if (current?.calledAt) {
    const elapsed = (now.getTime() - current.calledAt.getTime()) / MINUTE_MS;
    remainingCurrent = Math.max(1, Math.round(avgMin - elapsed));
  }
  return { status: "waiting", ahead, etaMinutes: ahead * avgMin + remainingCurrent, nowServing };
}

export type AlertKind = "three_ahead" | "next";

export interface AlertState {
  id: string;
  alertedThree: boolean;
  alertedNext: boolean;
}

/**
 * Which "your turn soon" WhatsApp alerts are due: one when 3 patients are ahead (or fewer, if the
 * token joined late), one when the token is next. Each alert is sent at most once per token.
 */
export function dueAlerts(tokens: readonly (QueueToken & AlertState)[]): { tokenId: string; kind: AlertKind }[] {
  const out: { tokenId: string; kind: AlertKind }[] = [];
  waitingOrder(tokens).forEach((t, ahead) => {
    if (ahead === 0 && !t.alertedNext) out.push({ tokenId: t.id, kind: "next" });
    else if (ahead > 0 && ahead <= 3 && !t.alertedThree) out.push({ tokenId: t.id, kind: "three_ahead" });
  });
  return out;
}

/** Display label for a token: doctor prefix + number, e.g. "A-07". */
export function tokenLabel(prefix: string, number: number): string {
  return `${prefix}-${String(number).padStart(2, "0")}`;
}

/** Minutes a token waited before being called (null if never called). */
export function waitMinutes(t: Pick<QueueToken, "calledAt"> & { joinedAt: Date }): number | null {
  if (!t.calledAt) return null;
  return Math.max(0, Math.round((t.calledAt.getTime() - t.joinedAt.getTime()) / MINUTE_MS));
}
