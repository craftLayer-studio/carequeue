/**
 * Token queue use cases: join from the reception QR, live status, staff actions, turn alerts.
 */
import { and, asc, eq, inArray, max } from "drizzle-orm";
import {
  averageConsultMinutes,
  dueAlerts,
  formatINR,
  isTerminal,
  istDay,
  nextStatus,
  pickNext,
  positionOf,
  tokenLabel,
  waitMinutes,
  type Priority,
  type QueueAction,
  type QueueToken,
  type Registration,
  type TokenKind,
  type TokenStatus,
} from "@/domain";
import { appUrl } from "../config";
import type { Db, Tx } from "../db/client";
import { contacts, doctors, followUps, payments, patients, tokens } from "../db/schema";
import type { Actor } from "./auth";
import { audit, getDoctor, getOrg, getOrgByQr, publicDoctor, publicOrg, requirePermission, type Doctor } from "./clinic";
import { StoreError, forbidden, notFound } from "./errors";
import { newId, randomToken } from "./ids";
import { sendTemplate } from "./messaging";
import { phoneFor, registerPatient, type ConsentChoices } from "./patients";
import { upiLinkForPayment } from "./payments";

export type TokenRow = typeof tokens.$inferSelect;

const ACTIVE: TokenStatus[] = ["waiting", "called", "skipped"];

function asQueueToken(t: TokenRow): QueueToken & { alertedThree: boolean; alertedNext: boolean; joinedAt: Date } {
  return {
    id: t.id,
    number: t.number,
    status: t.status as TokenStatus,
    priority: t.priority as Priority,
    queuedAt: t.queuedAt,
    calledAt: t.calledAt,
    doneAt: t.doneAt,
    joinedAt: t.joinedAt,
    alertedThree: t.alertedThree,
    alertedNext: t.alertedNext,
  };
}

async function dayTokens(tx: Tx, orgId: string, doctorId: string, day: string): Promise<TokenRow[]> {
  return tx
    .select()
    .from(tokens)
    .where(and(eq(tokens.orgId, orgId), eq(tokens.doctorId, doctorId), eq(tokens.day, day)))
    .orderBy(asc(tokens.number));
}

export function statusLink(publicToken: string) {
  return `${appUrl()}/s/${publicToken}`;
}

function assertQueueAccess(actor: Actor, doctorId: string) {
  requirePermission(actor, "queue:operate");
  if (actor.role === "doctor" && actor.doctorId !== doctorId) throw forbidden("Doctors can manage only their own queue");
}

export interface IssueTokenInput {
  doctorId: string;
  patientId: string;
  reason: string | null;
  priority?: Priority;
  kind?: TokenKind;
  appointmentId?: string | null;
}

export interface RegisterAndQueueInput {
  doctorId: string;
  registration: Registration;
  consent: ConsentChoices;
  priority?: Priority;
}

/**
 * Issue a token for a known patient (inside a transaction). If the patient already holds an
 * active token for this doctor today, that token is returned instead of a duplicate.
 */
export async function issueToken(tx: Tx, orgId: string, input: IssueTokenInput, now = new Date()): Promise<{ token: TokenRow; created: boolean }> {
  const org = await getOrg(tx, orgId);
  const doctor = await getDoctor(tx, orgId, input.doctorId);
  if (!doctor.active) throw new StoreError(400, "This doctor is not taking patients today");
  const [patient] = await tx
    .select()
    .from(patients)
    .where(and(eq(patients.orgId, orgId), eq(patients.id, input.patientId)));
  if (!patient) throw notFound("Patient");
  const day = istDay(now);

  const [existing] = await tx
    .select()
    .from(tokens)
    .where(
      and(
        eq(tokens.orgId, orgId),
        eq(tokens.doctorId, doctor.id),
        eq(tokens.day, day),
        eq(tokens.patientId, patient.id),
        inArray(tokens.status, ACTIVE),
      ),
    );
  if (existing) return { token: existing, created: false };

  const [{ value: last }] = await tx
    .select({ value: max(tokens.number) })
    .from(tokens)
    .where(and(eq(tokens.orgId, orgId), eq(tokens.doctorId, doctor.id), eq(tokens.day, day)));
  const [token] = await tx
    .insert(tokens)
    .values({
      id: newId("tok"),
      orgId,
      doctorId: doctor.id,
      patientId: patient.id,
      appointmentId: input.appointmentId ?? null,
      day,
      number: (last ?? 0) + 1,
      kind: input.kind ?? "walkin",
      priority: input.priority ?? "normal",
      status: "waiting",
      reason: input.reason,
      publicToken: randomToken(),
      joinedAt: now,
      queuedAt: now,
    })
    .returning();

  // A patient who had a follow-up due has returned.
  await tx
    .update(followUps)
    .set({ status: "returned", returnedAt: now })
    .where(and(eq(followUps.orgId, orgId), eq(followUps.patientId, patient.id), inArray(followUps.status, ["scheduled", "reminded"])));

  await sendTemplate(tx, orgId, patient.contactId, "token_issued", {
    clinic: org.name,
    patient: patient.name,
    doctor: doctor.name,
    token: tokenLabel(doctor.tokenPrefix, token.number),
    link: statusLink(token.publicToken),
  });
  await processAlerts(tx, orgId, doctor, day);
  return { token, created: true };
}

/** Patient scans the reception QR, registers with consent and joins a doctor's queue. */
export async function joinFromQr(db: Db, qrToken: string, input: Omit<RegisterAndQueueInput, "priority">, now = new Date()) {
  return db.transaction(async (tx) => {
    const org = await getOrgByQr(tx, qrToken);
    await getDoctor(tx, org.id, input.doctorId);
    const { patient } = await registerPatient(tx, org.id, input.registration, input.consent, "qr", now);
    const { token } = await issueToken(tx, org.id, { doctorId: input.doctorId, patientId: patient.id, reason: input.registration.reason }, now);
    return { publicToken: token.publicToken };
  });
}

/** Receptionist registers a walk-in at the desk (consent asked in person, recorded as staff channel). */
export async function addWalkIn(db: Db, actor: Actor, input: RegisterAndQueueInput, now = new Date()) {
  assertQueueAccess(actor, input.doctorId);
  return db.transaction(async (tx) => {
    await getDoctor(tx, actor.orgId, input.doctorId);
    const { patient } = await registerPatient(tx, actor.orgId, input.registration, input.consent, "staff", now);
    const { token, created } = await issueToken(
      tx,
      actor.orgId,
      { doctorId: input.doctorId, patientId: patient.id, reason: input.registration.reason, priority: input.priority, kind: "walkin" },
      now,
    );
    await audit(tx, actor, actor.orgId, "token.create", "token", token.id, null, now);
    return { tokenId: token.id, publicToken: token.publicToken, created };
  });
}

/** Send any "3 ahead" / "you're next" alerts now due in a doctor's queue. */
export async function processAlerts(tx: Tx, orgId: string, doctor: Doctor, day: string) {
  const list = await dayTokens(tx, orgId, doctor.id, day);
  const due = dueAlerts(list.map(asQueueToken));
  if (due.length === 0) return;
  const org = await getOrg(tx, orgId);
  for (const a of due) {
    const t = list.find((x) => x.id === a.tokenId)!;
    const [p] = await tx.select().from(patients).where(eq(patients.id, t.patientId));
    await sendTemplate(tx, orgId, p.contactId, a.kind === "next" ? "turn_next" : "turn_three_ahead", {
      clinic: org.name,
      patient: p.name,
      doctor: doctor.name,
      token: tokenLabel(doctor.tokenPrefix, t.number),
      link: statusLink(t.publicToken),
    });
    await tx
      .update(tokens)
      .set(a.kind === "next" ? { alertedNext: true, alertedThree: true } : { alertedThree: true })
      .where(eq(tokens.id, t.id));
  }
}

/** Live status for the patient's phone. Contains no phone number and nothing clinical. */
export async function tokenStatus(db: Db, publicToken: string, now = new Date()) {
  const [t] = await db.select().from(tokens).where(eq(tokens.publicToken, publicToken));
  if (!t) throw notFound("Token");
  const org = await getOrg(db, t.orgId);
  const doctor = await getDoctor(db, t.orgId, t.doctorId);
  const list = await dayTokens(db, t.orgId, t.doctorId, t.day);
  const q = list.map(asQueueToken);
  const avg = averageConsultMinutes(q, doctor.avgConsultMin);
  const pos = positionOf(q, t.id, now, avg);
  const [patient] = await db.select().from(patients).where(eq(patients.id, t.patientId));
  const [contact] = await db.select().from(contacts).where(eq(contacts.id, patient.contactId));
  const [payment] = await db.select().from(payments).where(eq(payments.tokenId, t.id));
  const nowServing = pos.nowServing === null ? null : tokenLabel(doctor.tokenPrefix, pos.nowServing);
  return {
    now: now.getTime(),
    clinic: publicOrg(org),
    doctor: publicDoctor(doctor),
    token: {
      label: tokenLabel(doctor.tokenPrefix, t.number),
      status: t.status as TokenStatus,
      day: t.day,
      isToday: t.day === istDay(now),
      patientFirstName: patient.name.split(" ")[0],
      joinedAt: t.joinedAt.getTime(),
      ahead: pos.ahead,
      etaMinutes: pos.etaMinutes,
      nowServing,
      avgConsultMin: avg,
      waiting: q.filter((x) => x.status === "waiting").length,
    },
    payment: payment
      ? {
          status: payment.status,
          method: payment.method,
          amount: formatINR(payment.amountPaise),
          upiLink: payment.status === "pending" && payment.method === "upi" ? upiLinkForPayment(org, payment, doctor) : null,
        }
      : null,
    prefsToken: contact.prefsToken,
  };
}

/** Patient cancels their own token from the status page. */
export async function cancelTokenByPatient(db: Db, publicToken: string) {
  return db.transaction(async (tx) => {
    const [t] = await tx.select().from(tokens).where(eq(tokens.publicToken, publicToken));
    if (!t) throw notFound("Token");
    const status = nextStatusOr400(t.status as TokenStatus, "cancel");
    await tx.update(tokens).set({ status }).where(eq(tokens.id, t.id));
    const doctor = await getDoctor(tx, t.orgId, t.doctorId);
    await processAlerts(tx, t.orgId, doctor, t.day);
    return { ok: true };
  });
}

function nextStatusOr400(from: TokenStatus, action: QueueAction): TokenStatus {
  try {
    return nextStatus(from, action);
  } catch (e) {
    throw new StoreError(409, (e as Error).message);
  }
}

async function applyAction(tx: Tx, actor: Actor, t: TokenRow, action: QueueAction, now: Date) {
  const status = nextStatusOr400(t.status as TokenStatus, action);
  const patch: Partial<TokenRow> = { status };
  if (action === "call") patch.calledAt = now;
  if (action === "done") patch.doneAt = now;
  if (action === "requeue") patch.queuedAt = now;
  await tx.update(tokens).set(patch).where(eq(tokens.id, t.id));
  await audit(tx, actor, actor.orgId, `token.${action}`, "token", t.id, null, now);
  return status;
}

/** Staff action on one token: call, done, skip, requeue, no-show, cancel. */
export async function actOnToken(db: Db, actor: Actor, tokenId: string, action: QueueAction, now = new Date()) {
  return db.transaction(async (tx) => {
    const [t] = await tx
      .select()
      .from(tokens)
      .where(and(eq(tokens.orgId, actor.orgId), eq(tokens.id, tokenId)));
    if (!t) throw notFound("Token");
    assertQueueAccess(actor, t.doctorId);
    if (action === "call") {
      // Only one patient with the doctor at a time: finish whoever is in.
      const current = (await dayTokens(tx, actor.orgId, t.doctorId, t.day)).filter((x) => x.status === "called");
      for (const c of current) await applyAction(tx, actor, c, "done", now);
    }
    const status = await applyAction(tx, actor, t, action, now);
    const doctor = await getDoctor(tx, actor.orgId, t.doctorId);
    await processAlerts(tx, actor.orgId, doctor, t.day);
    return { status };
  });
}

/** "Call next": finishes the patient currently in and calls the head of the line. */
export async function callNext(db: Db, actor: Actor, doctorId: string, now = new Date()) {
  assertQueueAccess(actor, doctorId);
  return db.transaction(async (tx) => {
    const doctor = await getDoctor(tx, actor.orgId, doctorId);
    const day = istDay(now);
    const list = await dayTokens(tx, actor.orgId, doctorId, day);
    for (const c of list.filter((x) => x.status === "called")) await applyAction(tx, actor, c, "done", now);
    const next = pickNext(list.map(asQueueToken));
    if (!next) {
      await processAlerts(tx, actor.orgId, doctor, day);
      return { called: null };
    }
    const row = list.find((x) => x.id === next.id)!;
    await applyAction(tx, actor, row, "call", now);
    await processAlerts(tx, actor.orgId, doctor, day);
    return { called: tokenLabel(doctor.tokenPrefix, row.number) };
  });
}

export async function setPriority(db: Db, actor: Actor, tokenId: string, priority: Priority, now = new Date()) {
  return db.transaction(async (tx) => {
    const [t] = await tx
      .select()
      .from(tokens)
      .where(and(eq(tokens.orgId, actor.orgId), eq(tokens.id, tokenId)));
    if (!t) throw notFound("Token");
    assertQueueAccess(actor, t.doctorId);
    if (isTerminal(t.status as TokenStatus)) throw new StoreError(409, "Token is already closed");
    await tx.update(tokens).set({ priority }).where(eq(tokens.id, t.id));
    await audit(tx, actor, actor.orgId, `token.priority.${priority}`, "token", t.id, null, now);
    const doctor = await getDoctor(tx, actor.orgId, t.doctorId);
    await processAlerts(tx, actor.orgId, doctor, t.day);
    return { priority };
  });
}

/** Today's queues for the staff screen. Phones are masked unless the role may see them. */
export async function staffQueues(db: Db, actor: Actor, now = new Date()) {
  requirePermission(actor, "queue:operate");
  const day = istDay(now);
  const docs = (await db.select().from(doctors).where(eq(doctors.orgId, actor.orgId)).orderBy(asc(doctors.tokenPrefix))).filter(
    (d) => d.active && (actor.role !== "doctor" || d.id === actor.doctorId),
  );
  const rows = await db
    .select({ token: tokens, patient: patients, phone: contacts.phone, payment: payments })
    .from(tokens)
    .innerJoin(patients, eq(patients.id, tokens.patientId))
    .innerJoin(contacts, eq(contacts.id, patients.contactId))
    .leftJoin(payments, eq(payments.tokenId, tokens.id))
    .where(and(eq(tokens.orgId, actor.orgId), eq(tokens.day, day)))
    .orderBy(asc(tokens.number));

  return {
    now: now.getTime(),
    day,
    queues: docs.map((d) => {
      const mine = rows.filter((r) => r.token.doctorId === d.id);
      const q = mine.map((r) => asQueueToken(r.token));
      const avg = averageConsultMinutes(q, d.avgConsultMin);
      const view = mine.map((r) => {
        const pos = positionOf(q, r.token.id, now, avg);
        return {
          id: r.token.id,
          label: tokenLabel(d.tokenPrefix, r.token.number),
          number: r.token.number,
          status: r.token.status as TokenStatus,
          kind: r.token.kind as TokenKind,
          priority: r.token.priority as Priority,
          reason: r.token.reason,
          patientId: r.patient.id,
          patientName: r.patient.name,
          age: r.patient.age,
          ...phoneFor(actor, r.phone),
          joinedAt: r.token.joinedAt.getTime(),
          calledAt: r.token.calledAt?.getTime() ?? null,
          waitedMin: waitMinutes(r.token),
          ahead: pos.ahead,
          etaMinutes: pos.etaMinutes,
          payment: r.payment ? { status: r.payment.status, method: r.payment.method, amount: formatINR(r.payment.amountPaise) } : null,
        };
      });
      const order = new Map(
        q
          .filter((x) => x.status === "waiting")
          .map((x) => [x.id, positionOf(q, x.id, now, avg).ahead ?? 0] as const),
      );
      const current = view.find((v) => v.status === "called") ?? null;
      return {
        doctor: { ...publicDoctor(d), fee: formatINR(d.feePaise) },
        avgConsultMin: avg,
        current,
        waiting: view.filter((v) => v.status === "waiting").sort((a, b) => order.get(a.id)! - order.get(b.id)!),
        skipped: view.filter((v) => v.status === "skipped"),
        finished: view.filter((v) => isTerminal(v.status)).reverse(),
      };
    }),
  };
}
