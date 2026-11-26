/**
 * Follow-up dates (set by the practitioner), reminder runs, review requests and clinic notices.
 * Every send goes through `sendTemplate`, which checks the purpose-specific consent.
 */
import { and, asc, desc, eq, gte, inArray, isNull, lt } from "drizzle-orm";
import {
  addDays,
  formatIstDay,
  formatIstTime,
  isIsoDay,
  isReminderDue,
  istDay,
  istDayStart,
  noticeProblems,
  validateFollowUpDate,
  type FollowUpStatus,
  type IsoDay,
} from "@/domain";
import { appUrl } from "../config";
import type { Db } from "../db/client";
import { appointments, consentRecords, contacts, doctors, followUps, outbox, patients, tokens } from "../db/schema";
import type { Actor } from "./auth";
import { audit, getDoctor, getOrg, requirePermission } from "./clinic";
import { StoreError, forbidden, notFound } from "./errors";
import { newId } from "./ids";
import { consentFor, sendTemplate } from "./messaging";
import { appointmentLink } from "./appointments";
import { phoneFor } from "./patients";

/** Doctor sets a follow-up date for a patient they saw. */
export async function setFollowUp(db: Db, actor: Actor, patientId: string, doctorId: string, dueDate: IsoDay, now = new Date()) {
  requirePermission(actor, "followup:set");
  if (actor.role === "doctor" && actor.doctorId !== doctorId) throw forbidden("Doctors can set follow-ups only for themselves");
  if (!isIsoDay(dueDate)) throw new StoreError(400, "dueDate must be YYYY-MM-DD");
  const problem = validateFollowUpDate(dueDate, now);
  if (problem) throw new StoreError(400, problem);
  return db.transaction(async (tx) => {
    await getDoctor(tx, actor.orgId, doctorId);
    const [p] = await tx
      .select()
      .from(patients)
      .where(and(eq(patients.orgId, actor.orgId), eq(patients.id, patientId)));
    if (!p) throw notFound("Patient");
    // One open follow-up per patient per doctor: replace the previous one.
    await tx
      .update(followUps)
      .set({ status: "cancelled" })
      .where(
        and(
          eq(followUps.orgId, actor.orgId),
          eq(followUps.patientId, patientId),
          eq(followUps.doctorId, doctorId),
          inArray(followUps.status, ["scheduled", "reminded"]),
        ),
      );
    const id = newId("fup");
    await tx.insert(followUps).values({
      id,
      orgId: actor.orgId,
      patientId,
      doctorId,
      dueDate,
      status: "scheduled",
      setBy: actor.staffId,
      createdAt: now,
    });
    await audit(tx, actor, actor.orgId, "followup.set", "patient", patientId, null, now);
    return { id, dueDate };
  });
}

export async function listFollowUps(db: Db, actor: Actor) {
  requirePermission(actor, "patient:view");
  const rows = await db
    .select({ f: followUps, p: patients, phone: contacts.phone, d: doctors })
    .from(followUps)
    .innerJoin(patients, eq(patients.id, followUps.patientId))
    .innerJoin(contacts, eq(contacts.id, patients.contactId))
    .innerJoin(doctors, eq(doctors.id, followUps.doctorId))
    .where(and(eq(followUps.orgId, actor.orgId), inArray(followUps.status, ["scheduled", "reminded", "returned"])))
    .orderBy(asc(followUps.dueDate))
    .limit(200);
  return rows.map((r) => ({
    id: r.f.id,
    dueDate: r.f.dueDate,
    status: r.f.status as FollowUpStatus,
    patientId: r.p.id,
    patientName: r.p.name,
    doctorName: r.d.name,
    remindedAt: r.f.remindedAt?.getTime() ?? null,
    ...phoneFor(actor, r.phone),
  }));
}

/**
 * Run reminders now: follow-ups due within 2 days, and appointments for today/tomorrow not yet
 * reminded. In production this runs on a schedule; the MVP runs it from a button.
 */
export async function sendDueReminders(db: Db, actor: Actor, now = new Date()) {
  requirePermission(actor, "reminders:send");
  return db.transaction(async (tx) => {
    const org = await getOrg(tx, actor.orgId);
    let sent = 0;
    let skipped = 0;

    const fups = await tx
      .select({ f: followUps, p: patients, d: doctors })
      .from(followUps)
      .innerJoin(patients, eq(patients.id, followUps.patientId))
      .innerJoin(doctors, eq(doctors.id, followUps.doctorId))
      .where(and(eq(followUps.orgId, actor.orgId), eq(followUps.status, "scheduled")));
    for (const r of fups) {
      if (!isReminderDue({ status: r.f.status as FollowUpStatus, dueDate: r.f.dueDate }, now)) continue;
      const res = await sendTemplate(tx, actor.orgId, r.p.contactId, "followup_reminder", {
        clinic: org.name,
        patient: r.p.name,
        doctor: r.d.name,
        when: formatIstDay(r.f.dueDate),
        link: `${appUrl()}/q/${org.qrToken}/book`,
      });
      if (res.sent) sent += 1;
      else skipped += 1;
      await tx.update(followUps).set({ status: "reminded", remindedAt: now }).where(eq(followUps.id, r.f.id));
    }

    const today = istDay(now);
    const appts = await tx
      .select({ a: appointments, p: patients, d: doctors })
      .from(appointments)
      .innerJoin(patients, eq(patients.id, appointments.patientId))
      .innerJoin(doctors, eq(doctors.id, appointments.doctorId))
      .where(
        and(
          eq(appointments.orgId, actor.orgId),
          eq(appointments.status, "booked"),
          isNull(appointments.reminderSentAt),
          gte(appointments.startsAt, now),
          lt(appointments.startsAt, istDayStart(addDays(today, 2))),
        ),
      );
    for (const r of appts) {
      const res = await sendTemplate(tx, actor.orgId, r.p.contactId, "appointment_reminder", {
        clinic: org.name,
        patient: r.p.name,
        doctor: r.d.name,
        when: `${formatIstDay(istDay(r.a.startsAt))}, ${formatIstTime(r.a.startsAt)}`,
        link: appointmentLink(r.a.publicToken),
      });
      if (res.sent) sent += 1;
      else skipped += 1;
      await tx.update(appointments).set({ reminderSentAt: now }).where(eq(appointments.id, r.a.id));
    }
    await audit(tx, actor, actor.orgId, "reminders.run", "org", actor.orgId, null, now);
    return { sent, skippedNoConsent: skipped };
  });
}

/** Ask today's seen patients (who opted in to clinic news) for a Google review. */
export async function sendReviewRequests(db: Db, actor: Actor, now = new Date()) {
  requirePermission(actor, "settings:manage");
  return db.transaction(async (tx) => {
    const org = await getOrg(tx, actor.orgId);
    if (!org.reviewUrl) throw new StoreError(400, "Add your Google review link in settings first");
    const seen = await tx
      .select({ p: patients })
      .from(tokens)
      .innerJoin(patients, eq(patients.id, tokens.patientId))
      .where(and(eq(tokens.orgId, actor.orgId), eq(tokens.day, istDay(now)), eq(tokens.status, "done")));
    const already = new Set(
      (
        await tx
          .select({ contactId: outbox.contactId })
          .from(outbox)
          .where(and(eq(outbox.orgId, actor.orgId), eq(outbox.template, "review_request"), gte(outbox.createdAt, istDayStart(istDay(now)))))
      ).map((r) => r.contactId),
    );
    let sent = 0;
    let skipped = 0;
    for (const { p } of seen) {
      if (already.has(p.contactId)) continue;
      already.add(p.contactId);
      const consent = await consentFor(tx, actor.orgId, p.contactId);
      if (!consent.marketing) {
        skipped += 1;
        continue;
      }
      await sendTemplate(tx, actor.orgId, p.contactId, "review_request", { clinic: org.name, patient: p.name, link: org.reviewUrl });
      sent += 1;
    }
    await audit(tx, actor, actor.orgId, "reviews.request", "org", actor.orgId, null, now);
    return { sent, skippedNoConsent: skipped };
  });
}

/**
 * Practitioner-approved clinic notice (health camp, holiday hours) to contacts who opted in to
 * clinic news. Offers, discounts and medical claims are rejected.
 */
export async function sendClinicNotice(db: Db, actor: Actor, text: string, approvedByPractitioner: boolean, now = new Date()) {
  requirePermission(actor, "settings:manage");
  if (!approvedByPractitioner) throw new StoreError(400, "A practitioner must approve the notice before it is sent");
  const problems = noticeProblems(text);
  if (problems.length > 0) throw new StoreError(400, problems.join(". "));
  return db.transaction(async (tx) => {
    const org = await getOrg(tx, actor.orgId);
    const list = await tx.select().from(contacts).where(eq(contacts.orgId, actor.orgId));
    let sent = 0;
    for (const c of list) {
      const consent = await consentFor(tx, actor.orgId, c.id);
      if (!consent.marketing) continue;
      const [p] = await tx.select().from(patients).where(eq(patients.contactId, c.id)).orderBy(asc(patients.createdAt)).limit(1);
      await sendTemplate(tx, actor.orgId, c.id, "clinic_notice", { clinic: org.name, patient: p?.name ?? "", text: text.trim() });
      sent += 1;
    }
    await audit(tx, actor, actor.orgId, "notice.send", "org", actor.orgId, null, now);
    return { sent, audience: list.length };
  });
}

/** Outbox for the owner/reception screen. Phones masked by role. */
export async function listOutbox(db: Db, actor: Actor, limit = 100) {
  requirePermission(actor, "outbox:view");
  const rows = await db
    .select()
    .from(outbox)
    .where(eq(outbox.orgId, actor.orgId))
    .orderBy(desc(outbox.createdAt))
    .limit(limit);
  return rows.map((r) => ({
    id: r.id,
    at: r.createdAt.getTime(),
    template: r.template,
    purpose: r.purpose,
    status: r.status,
    adapter: r.adapter,
    body: r.body,
    ...phoneFor(actor, r.toPhone),
  }));
}

/** Count of contacts by current consent, for the dashboard. */
export async function consentCounts(db: Db, orgId: string) {
  const list = await db.select({ id: contacts.id }).from(contacts).where(eq(contacts.orgId, orgId));
  const counts = { contacts: list.length, service: 0, reminders: 0, marketing: 0 };
  if (list.length === 0) return counts;
  const rows = await db.select().from(consentRecords).where(eq(consentRecords.orgId, orgId)).orderBy(asc(consentRecords.at));
  const latest = new Map<string, boolean>();
  for (const r of rows) latest.set(`${r.contactId}:${r.purpose}`, r.granted);
  for (const c of list) {
    if (latest.get(`${c.id}:service`)) counts.service += 1;
    if (latest.get(`${c.id}:reminders`)) counts.reminders += 1;
    if (latest.get(`${c.id}:marketing`)) counts.marketing += 1;
  }
  return counts;
}
