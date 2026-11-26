/**
 * Patients and consent. Contacts are keyed by E.164 phone per clinic; family members share one
 * contact. Staff record views are written to the audit log; phones are masked unless the viewer
 * is a receptionist or doctor.
 */
import { and, desc, eq, ilike, inArray, or } from "drizzle-orm";
import {
  can,
  consentChanges,
  istDay,
  maskPhone,
  formatPhone,
  nameKey,
  NOTICE_VERSION,
  type ConsentChannel,
  type ConsentState,
  type Registration,
  validateRegistration,
} from "@/domain";
import type { Tx } from "../db/client";
import { appointments, consentRecords, contacts, doctors, followUps, patients, payments, tokens } from "../db/schema";
import type { Actor } from "./auth";
import { audit, requirePermission } from "./clinic";
import { StoreError, notFound } from "./errors";
import { newId, randomToken } from "./ids";
import { consentFor } from "./messaging";

export type Patient = typeof patients.$inferSelect;
export type Contact = typeof contacts.$inferSelect;

export interface ConsentChoices {
  service: boolean;
  reminders: boolean;
  marketing: boolean;
}

/**
 * Find or create the contact and patient for a registration, and record consent choices.
 * Service consent is required: the queue cannot run without processing these details.
 */
export async function registerPatient(
  tx: Tx,
  orgId: string,
  input: Registration,
  choices: ConsentChoices,
  channel: ConsentChannel,
  now = new Date(),
): Promise<{ contact: Contact; patient: Patient }> {
  // Re-validate here so no caller can skip normalisation (phone to E.164, name, age bounds).
  const checked = validateRegistration(input);
  if (!checked.ok) throw new StoreError(400, Object.values(checked.errors).join(". "));
  const reg = checked.value;
  if (!choices.service) throw new StoreError(400, "Please agree to the use of your details for this visit to get a token");

  let [contact] = await tx
    .select()
    .from(contacts)
    .where(and(eq(contacts.orgId, orgId), eq(contacts.phone, reg.phone)));
  if (!contact) {
    [contact] = await tx
      .insert(contacts)
      .values({ id: newId("con"), orgId, phone: reg.phone, prefsToken: randomToken(), createdAt: now })
      .onConflictDoNothing()
      .returning();
    if (!contact) {
      [contact] = await tx
        .select()
        .from(contacts)
        .where(and(eq(contacts.orgId, orgId), eq(contacts.phone, reg.phone)));
    }
  }

  const key = nameKey(reg.name);
  let [patient] = await tx
    .select()
    .from(patients)
    .where(and(eq(patients.orgId, orgId), eq(patients.contactId, contact.id), eq(patients.nameKey, key)));
  if (!patient) {
    [patient] = await tx
      .insert(patients)
      .values({ id: newId("pat"), orgId, contactId: contact.id, name: reg.name, nameKey: key, age: reg.age, createdAt: now })
      .returning();
  } else if (patient.age !== reg.age) {
    [patient] = await tx.update(patients).set({ age: reg.age }).where(eq(patients.id, patient.id)).returning();
  }

  await recordConsent(tx, orgId, contact.id, choices, channel, now, true);
  return { contact, patient };
}

/**
 * Write consent records. On registration (`explicit`), every purpose is recorded as chosen, so
 * the ledger shows exactly what the patient ticked. Otherwise only changes are recorded.
 */
export async function recordConsent(
  tx: Tx,
  orgId: string,
  contactId: string,
  desired: Partial<ConsentState>,
  channel: ConsentChannel,
  now = new Date(),
  explicit = false,
): Promise<ConsentState> {
  const current = await consentFor(tx, orgId, contactId);
  const changes = explicit
    ? (Object.entries(desired) as [keyof ConsentState, boolean | undefined][])
        .filter(([, v]) => v !== undefined)
        .map(([purpose, granted]) => ({ purpose, granted: granted! }))
    : consentChanges(current, desired);
  if (changes.length > 0) {
    await tx.insert(consentRecords).values(
      changes.map((c) => ({
        id: newId("cns"),
        orgId,
        contactId,
        purpose: c.purpose,
        granted: c.granted,
        noticeVersion: NOTICE_VERSION,
        channel,
        at: now,
      })),
    );
  }
  return { ...current, ...Object.fromEntries(changes.map((c) => [c.purpose, c.granted])) };
}

/** Phone as this actor is allowed to see it. */
export function phoneFor(actor: Actor, phone: string): { phone: string; masked: boolean } {
  return can(actor.role, "patient:viewFullPhone") ? { phone: formatPhone(phone), masked: false } : { phone: maskPhone(phone), masked: true };
}

/** Search patients by name or last digits of phone. Results show masked or full phones by role. */
export async function searchPatients(tx: Tx, actor: Actor, query: string) {
  requirePermission(actor, "patient:view");
  const q = query.trim().slice(0, 40);
  const digits = q.replace(/\D/g, "");
  const conds = [eq(patients.orgId, actor.orgId)];
  const rows = await tx
    .select({ id: patients.id, name: patients.name, age: patients.age, phone: contacts.phone, createdAt: patients.createdAt })
    .from(patients)
    .innerJoin(contacts, eq(contacts.id, patients.contactId))
    .where(
      q.length === 0
        ? and(...conds)
        : and(
            ...conds,
            or(
              ilike(patients.name, `%${q.replace(/[%_\\]/g, "")}%`),
              digits.length >= 4 ? ilike(contacts.phone, `%${digits}`) : undefined,
            ),
          ),
    )
    .orderBy(desc(patients.createdAt))
    .limit(50);
  return rows.map((r) => ({ id: r.id, name: r.name, age: r.age, ...phoneFor(actor, r.phone) }));
}

/** Open a patient record. Writes an audit row for every view. */
export async function viewPatient(tx: Tx, actor: Actor, patientId: string, ip: string | null, now = new Date()) {
  requirePermission(actor, "patient:view");
  const [row] = await tx
    .select({ patient: patients, contact: contacts })
    .from(patients)
    .innerJoin(contacts, eq(contacts.id, patients.contactId))
    .where(and(eq(patients.orgId, actor.orgId), eq(patients.id, patientId)));
  if (!row) throw notFound("Patient");
  await audit(tx, actor, actor.orgId, "patient.view", "patient", patientId, ip, now);

  const visits = await tx
    .select({
      id: tokens.id,
      day: tokens.day,
      number: tokens.number,
      status: tokens.status,
      reason: tokens.reason,
      doctorName: doctors.name,
      prefix: doctors.tokenPrefix,
      paymentStatus: payments.status,
      paymentMethod: payments.method,
      amountPaise: payments.amountPaise,
    })
    .from(tokens)
    .innerJoin(doctors, eq(doctors.id, tokens.doctorId))
    .leftJoin(payments, eq(payments.tokenId, tokens.id))
    .where(and(eq(tokens.orgId, actor.orgId), eq(tokens.patientId, patientId)))
    .orderBy(desc(tokens.joinedAt))
    .limit(20);

  const appts = await tx
    .select({ id: appointments.id, startsAt: appointments.startsAt, status: appointments.status, doctorName: doctors.name })
    .from(appointments)
    .innerJoin(doctors, eq(doctors.id, appointments.doctorId))
    .where(and(eq(appointments.orgId, actor.orgId), eq(appointments.patientId, patientId)))
    .orderBy(desc(appointments.startsAt))
    .limit(10);

  const fups = await tx
    .select({ id: followUps.id, dueDate: followUps.dueDate, status: followUps.status, doctorName: doctors.name })
    .from(followUps)
    .innerJoin(doctors, eq(doctors.id, followUps.doctorId))
    .where(and(eq(followUps.orgId, actor.orgId), eq(followUps.patientId, patientId)))
    .orderBy(desc(followUps.dueDate));

  const family = await tx
    .select({ id: patients.id, name: patients.name, age: patients.age })
    .from(patients)
    .where(and(eq(patients.orgId, actor.orgId), eq(patients.contactId, row.contact.id)));

  const consent = await consentFor(tx, actor.orgId, row.contact.id);
  const ledger = await tx
    .select({ purpose: consentRecords.purpose, granted: consentRecords.granted, channel: consentRecords.channel, at: consentRecords.at, noticeVersion: consentRecords.noticeVersion })
    .from(consentRecords)
    .where(and(eq(consentRecords.orgId, actor.orgId), eq(consentRecords.contactId, row.contact.id)))
    .orderBy(desc(consentRecords.at))
    .limit(20);

  return {
    patient: { id: row.patient.id, name: row.patient.name, age: row.patient.age, since: istDay(row.patient.createdAt) },
    contact: phoneFor(actor, row.contact.phone),
    family: family.filter((f) => f.id !== patientId),
    consent,
    consentLedger: ledger,
    visits,
    appointments: appts,
    followUps: fups,
  };
}

/** Patient self-service: current choices for the "manage messages" page (no login, random token). */
export async function prefsByToken(tx: Tx, prefsToken: string) {
  const [contact] = await tx.select().from(contacts).where(eq(contacts.prefsToken, prefsToken));
  if (!contact) throw notFound("Link");
  const consent = await consentFor(tx, contact.orgId, contact.id);
  const names = await tx.select({ name: patients.name }).from(patients).where(eq(patients.contactId, contact.id));
  return { contact, consent, phone: maskPhone(contact.phone), names: names.map((n) => n.name) };
}

export async function updatePrefsByToken(tx: Tx, prefsToken: string, desired: Partial<ConsentState>, now = new Date()) {
  const { contact } = await prefsByToken(tx, prefsToken);
  return recordConsent(tx, contact.orgId, contact.id, desired, "optout_link", now);
}

export async function patientsByIds(tx: Tx, orgId: string, ids: string[]) {
  if (ids.length === 0) return [];
  return tx
    .select({ id: patients.id, name: patients.name, age: patients.age, phone: contacts.phone, contactId: contacts.id })
    .from(patients)
    .innerJoin(contacts, eq(contacts.id, patients.contactId))
    .where(and(eq(patients.orgId, orgId), inArray(patients.id, ids)));
}
