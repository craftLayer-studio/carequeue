/**
 * Appointment booking per doctor (public, from the clinic link) and check-in on arrival.
 */
import { and, asc, eq, gte, inArray, lt, ne } from "drizzle-orm";
import {
  addDays,
  bookableDays,
  formatIstDay,
  formatIstTime,
  isBookable,
  istDay,
  istDayStart,
  slotsFor,
  tokenLabel,
  type DoctorSchedule,
  type IsoDay,
  type Registration,
} from "@/domain";
import { appUrl } from "../config";
import type { Db, Tx } from "../db/client";
import { appointments, contacts, doctors, patients, tokens } from "../db/schema";
import type { Actor } from "./auth";
import { audit, getDoctor, getOrg, getOrgByQr, listDoctors, publicDoctor, publicOrg, requirePermission, type Doctor } from "./clinic";
import { StoreError, notFound } from "./errors";
import { newId, randomToken } from "./ids";
import { sendTemplate } from "./messaging";
import { phoneFor, registerPatient, type ConsentChoices } from "./patients";
import { issueToken, statusLink } from "./queue";

const scheduleOf = (d: Doctor): DoctorSchedule => ({ sessions: d.sessions, slotMinutes: d.slotMinutes, weeklyOff: d.weeklyOff });

export function appointmentLink(publicToken: string) {
  return `${appUrl()}/a/${publicToken}`;
}

async function bookedStarts(tx: Tx, orgId: string, doctorId: string, day: IsoDay): Promise<Date[]> {
  const from = istDayStart(day);
  const to = istDayStart(addDays(day, 1));
  const rows = await tx
    .select({ startsAt: appointments.startsAt })
    .from(appointments)
    .where(
      and(
        eq(appointments.orgId, orgId),
        eq(appointments.doctorId, doctorId),
        ne(appointments.status, "cancelled"),
        gte(appointments.startsAt, from),
        lt(appointments.startsAt, to),
      ),
    );
  return rows.map((r) => r.startsAt);
}

/** Clinic and doctors for the public booking page. */
export async function bookingInfo(db: Db, qrToken: string, now = new Date()) {
  const org = await getOrgByQr(db, qrToken);
  const docs = await listDoctors(db, org.id);
  return {
    clinic: publicOrg(org),
    doctors: docs.map((d) => ({ ...publicDoctor(d), days: bookableDays(scheduleOf(d), now) })),
  };
}

export async function availableSlots(db: Db, qrToken: string, doctorId: string, day: IsoDay, now = new Date()) {
  const org = await getOrgByQr(db, qrToken);
  const doctor = await getDoctor(db, org.id, doctorId);
  if (!bookableDays(scheduleOf(doctor), now).includes(day)) return { day, slots: [] };
  const slots = slotsFor(scheduleOf(doctor), day, await bookedStarts(db, org.id, doctor.id, day), now);
  return { day, slots: slots.map((s) => ({ time: s.time, startsAt: s.startsAt.toISOString(), available: s.available })) };
}

/** Book a slot. The slot is re-checked on the server; a unique index stops double booking. */
export async function bookAppointment(
  db: Db,
  qrToken: string,
  input: { doctorId: string; startsAt: Date; registration: Registration; consent: ConsentChoices },
  now = new Date(),
) {
  try {
    return await db.transaction(async (tx) => {
      const org = await getOrgByQr(tx, qrToken);
      const doctor = await getDoctor(tx, org.id, input.doctorId);
      if (!doctor.active) throw new StoreError(400, "This doctor is not taking bookings");
      const booked = await bookedStarts(tx, org.id, doctor.id, istDay(input.startsAt));
      if (!isBookable(scheduleOf(doctor), input.startsAt, booked, now)) throw new StoreError(409, "That time is no longer available. Pick another slot.");
      const { contact, patient } = await registerPatient(tx, org.id, input.registration, input.consent, "booking", now);
      const [appt] = await tx
        .insert(appointments)
        .values({
          id: newId("apt"),
          orgId: org.id,
          doctorId: doctor.id,
          patientId: patient.id,
          startsAt: input.startsAt,
          status: "booked",
          publicToken: randomToken(),
          reason: input.registration.reason,
          createdAt: now,
        })
        .returning();
      await sendTemplate(tx, org.id, contact.id, "appointment_booked", {
        clinic: org.name,
        patient: patient.name,
        doctor: doctor.name,
        when: `${formatIstDay(istDay(appt.startsAt))}, ${formatIstTime(appt.startsAt)}`,
        link: appointmentLink(appt.publicToken),
      });
      return { publicToken: appt.publicToken };
    });
  } catch (e) {
    if (e instanceof StoreError) throw e;
    const code = (e as { code?: string; cause?: { code?: string } }).code ?? (e as { cause?: { code?: string } }).cause?.code;
    if (code === "23505") throw new StoreError(409, "That time was just booked by someone else. Pick another slot.");
    throw e;
  }
}

/** Public appointment page. */
export async function appointmentStatus(db: Db, publicToken: string, now = new Date()) {
  const [a] = await db.select().from(appointments).where(eq(appointments.publicToken, publicToken));
  if (!a) throw notFound("Appointment");
  const org = await getOrg(db, a.orgId);
  const doctor = await getDoctor(db, a.orgId, a.doctorId);
  const [p] = await db.select().from(patients).where(eq(patients.id, a.patientId));
  const [c] = await db.select().from(contacts).where(eq(contacts.id, p.contactId));
  const [t] = await db.select().from(tokens).where(eq(tokens.appointmentId, a.id));
  return {
    now: now.getTime(),
    clinic: publicOrg(org),
    doctor: publicDoctor(doctor),
    appointment: {
      status: a.status,
      startsAt: a.startsAt.getTime(),
      when: `${formatIstDay(istDay(a.startsAt))}, ${formatIstTime(a.startsAt)}`,
      patientFirstName: p.name.split(" ")[0],
      canCheckIn: a.status === "booked" && istDay(a.startsAt) === istDay(now),
      canCancel: a.status === "booked" && a.startsAt.getTime() > now.getTime(),
    },
    tokenLink: t ? `/s/${t.publicToken}` : null,
    prefsToken: c.prefsToken,
  };
}

async function checkInTx(tx: Tx, a: typeof appointments.$inferSelect, now: Date) {
  if (a.status !== "booked") throw new StoreError(409, a.status === "checked_in" ? "Already checked in" : "This appointment is not active");
  if (istDay(a.startsAt) !== istDay(now)) throw new StoreError(409, "Check-in opens on the day of the appointment");
  const { token } = await issueToken(
    tx,
    a.orgId,
    { doctorId: a.doctorId, patientId: a.patientId, reason: a.reason, kind: "appointment", appointmentId: a.id },
    now,
  );
  await tx.update(appointments).set({ status: "checked_in" }).where(eq(appointments.id, a.id));
  return token;
}

/** Patient checks in on arrival (scan at reception, then tap check-in): joins the queue. */
export async function checkInByPatient(db: Db, publicToken: string, now = new Date()) {
  return db.transaction(async (tx) => {
    const [a] = await tx.select().from(appointments).where(eq(appointments.publicToken, publicToken));
    if (!a) throw notFound("Appointment");
    const token = await checkInTx(tx, a, now);
    return { statusPath: `/s/${token.publicToken}` };
  });
}

export async function cancelAppointmentByPatient(db: Db, publicToken: string) {
  const [a] = await db.select().from(appointments).where(eq(appointments.publicToken, publicToken));
  if (!a) throw notFound("Appointment");
  if (a.status !== "booked") throw new StoreError(409, "This appointment is not active");
  await db.update(appointments).set({ status: "cancelled" }).where(eq(appointments.id, a.id));
  return { ok: true };
}

/** Staff: check in, cancel or mark no-show. */
export async function staffAppointmentAction(
  db: Db,
  actor: Actor,
  appointmentId: string,
  action: "check_in" | "cancel" | "no_show",
  now = new Date(),
) {
  requirePermission(actor, "appointment:manage");
  return db.transaction(async (tx) => {
    const [a] = await tx
      .select()
      .from(appointments)
      .where(and(eq(appointments.orgId, actor.orgId), eq(appointments.id, appointmentId)));
    if (!a) throw notFound("Appointment");
    if (actor.role === "doctor" && actor.doctorId !== a.doctorId) throw new StoreError(403, "Doctors can manage only their own appointments");
    if (action === "check_in") {
      const token = await checkInTx(tx, a, now);
      await audit(tx, actor, actor.orgId, "appointment.check_in", "appointment", a.id, null, now);
      const doctor = await getDoctor(tx, a.orgId, a.doctorId);
      return { status: "checked_in", token: tokenLabel(doctor.tokenPrefix, token.number), statusLink: statusLink(token.publicToken) };
    }
    if (a.status !== "booked") throw new StoreError(409, "This appointment is not active");
    const status = action === "cancel" ? "cancelled" : "no_show";
    await tx.update(appointments).set({ status }).where(eq(appointments.id, a.id));
    await audit(tx, actor, actor.orgId, `appointment.${action}`, "appointment", a.id, null, now);
    return { status };
  });
}

/** Staff list of appointments for a day, by doctor. */
export async function staffAppointments(db: Db, actor: Actor, day: IsoDay) {
  requirePermission(actor, "appointment:manage");
  const rows = await db
    .select({ a: appointments, p: patients, phone: contacts.phone, d: doctors })
    .from(appointments)
    .innerJoin(patients, eq(patients.id, appointments.patientId))
    .innerJoin(contacts, eq(contacts.id, patients.contactId))
    .innerJoin(doctors, eq(doctors.id, appointments.doctorId))
    .where(
      and(
        eq(appointments.orgId, actor.orgId),
        gte(appointments.startsAt, istDayStart(day)),
        lt(appointments.startsAt, istDayStart(addDays(day, 1))),
        inArray(appointments.status, ["booked", "checked_in", "no_show", "cancelled"]),
      ),
    )
    .orderBy(asc(appointments.startsAt));
  return rows
    .filter((r) => actor.role !== "doctor" || r.a.doctorId === actor.doctorId)
    .map((r) => ({
      id: r.a.id,
      time: formatIstTime(r.a.startsAt),
      startsAt: r.a.startsAt.getTime(),
      status: r.a.status,
      doctorId: r.d.id,
      doctorName: r.d.name,
      patientId: r.p.id,
      patientName: r.p.name,
      age: r.p.age,
      reason: r.a.reason,
      ...phoneFor(actor, r.phone),
    }));
}
