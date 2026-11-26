/**
 * Owner dashboard, settings, QR sheet and audit log.
 */
import { and, desc, eq, gte, inArray, lt } from "drizzle-orm";
import QRCode from "qrcode";
import {
  addDays,
  formatINR,
  isValidSessions,
  isValidVpa,
  istDay,
  istDayStart,
  summarizeDays,
  totals,
  type AppointmentFact,
  type PaymentFact,
  type TokenFact,
} from "@/domain";
import { appUrl } from "../config";
import type { Db } from "../db/client";
import { appointments, auditLog, doctors, followUps, orgs, outbox, payments, staff, tokens } from "../db/schema";
import type { Actor } from "./auth";
import { audit, getOrg, listDoctors, requirePermission } from "./clinic";
import { StoreError, notFound } from "./errors";
import { consentCounts } from "./followups";

export const DASHBOARD_DAYS = 7;

export async function dashboard(db: Db, actor: Actor, now = new Date()) {
  requirePermission(actor, "dashboard:view");
  const today = istDay(now);
  const days = Array.from({ length: DASHBOARD_DAYS }, (_, i) => addDays(today, i - (DASHBOARD_DAYS - 1)));
  const from = istDayStart(days[0]);
  const to = istDayStart(addDays(today, 1));

  const tokenRows = await db
    .select({ status: tokens.status, joinedAt: tokens.joinedAt, calledAt: tokens.calledAt })
    .from(tokens)
    .where(and(eq(tokens.orgId, actor.orgId), inArray(tokens.day, days)));
  const apptRows = await db
    .select({ status: appointments.status, startsAt: appointments.startsAt })
    .from(appointments)
    .where(and(eq(appointments.orgId, actor.orgId), gte(appointments.startsAt, from), lt(appointments.startsAt, to)));
  const payRows = await db
    .select({ status: payments.status, method: payments.method, amount: payments.amountPaise, paidAt: payments.paidAt })
    .from(payments)
    .where(and(eq(payments.orgId, actor.orgId), gte(payments.createdAt, from)));

  const rows = summarizeDays(days, {
    tokens: tokenRows as TokenFact[],
    appointments: apptRows as AppointmentFact[],
    payments: payRows as PaymentFact[],
  });
  const week = totals(rows);
  const todayRow = rows[rows.length - 1];
  const pendingUpi = payRows.filter((p) => p.status === "pending").reduce((s, p) => s + p.amount, 0);

  const fup = await db
    .select({ status: followUps.status, dueDate: followUps.dueDate })
    .from(followUps)
    .where(eq(followUps.orgId, actor.orgId));
  const reminded = fup.filter((f) => f.status === "reminded" || f.status === "returned").length;
  const returned = fup.filter((f) => f.status === "returned").length;
  const dueSoon = fup.filter((f) => (f.status === "scheduled" || f.status === "reminded") && f.dueDate <= addDays(today, 7)).length;

  const msgs = await db
    .select({ status: outbox.status, purpose: outbox.purpose })
    .from(outbox)
    .where(and(eq(outbox.orgId, actor.orgId), gte(outbox.createdAt, from)));

  const upcoming = await db
    .select({ id: appointments.id })
    .from(appointments)
    .where(and(eq(appointments.orgId, actor.orgId), eq(appointments.status, "booked"), gte(appointments.startsAt, now)));

  return {
    now: now.getTime(),
    today: {
      ...todayRow,
      collectedUpi: formatINR(todayRow.collectedUpi),
      collectedCash: formatINR(todayRow.collectedCash),
      collected: formatINR(todayRow.collectedUpi + todayRow.collectedCash),
      pendingUpi: formatINR(pendingUpi),
    },
    week: { ...week, collected: formatINR(week.collected) },
    days: rows.map((r) => ({ ...r, collected: formatINR(r.collectedUpi + r.collectedCash) })),
    followUps: { total: fup.length, reminded, returned, dueSoon },
    messages: {
      sent: msgs.filter((m) => m.status === "sent").length,
      skippedNoConsent: msgs.filter((m) => m.status !== "sent").length,
      reminders: msgs.filter((m) => m.purpose === "reminders" && m.status === "sent").length,
      marketing: msgs.filter((m) => m.purpose === "marketing" && m.status === "sent").length,
    },
    consent: await consentCounts(db, actor.orgId),
    upcomingAppointments: upcoming.length,
  };
}

/** Printable reception QR (SVG) and the links it encodes. */
export async function qrSheet(db: Db, actor: Actor) {
  requirePermission(actor, "settings:manage");
  const org = await getOrg(db, actor.orgId);
  const tokenUrl = `${appUrl()}/q/${org.qrToken}`;
  const bookUrl = `${tokenUrl}/book`;
  const svg = (url: string) => QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M" });
  return { clinic: org.name, isDemo: org.isDemo, tokenUrl, bookUrl, tokenSvg: await svg(tokenUrl), bookSvg: await svg(bookUrl) };
}

export async function settings(db: Db, actor: Actor) {
  requirePermission(actor, "settings:manage");
  const org = await getOrg(db, actor.orgId);
  const docs = await listDoctors(db, actor.orgId, false);
  const team = await db.select().from(staff).where(eq(staff.orgId, actor.orgId));
  return {
    clinic: { name: org.name, city: org.city, address: org.address, phone: org.phone, upiVpa: org.upiVpa, upiPayee: org.upiPayee, reviewUrl: org.reviewUrl ?? "", isDemo: org.isDemo },
    doctors: docs.map((d) => ({
      id: d.id,
      name: d.name,
      speciality: d.speciality,
      qualification: d.qualification,
      registrationNo: d.registrationNo,
      tokenPrefix: d.tokenPrefix,
      feeRupees: d.feePaise / 100,
      avgConsultMin: d.avgConsultMin,
      slotMinutes: d.slotMinutes,
      sessions: d.sessions,
      active: d.active,
    })),
    staff: team.map((s) => ({ id: s.id, name: s.name, role: s.role, active: s.active })),
  };
}

export async function updateClinic(
  db: Db,
  actor: Actor,
  patch: { name: string; address: string; upiVpa: string; upiPayee: string; reviewUrl: string | null },
) {
  requirePermission(actor, "settings:manage");
  if (!isValidVpa(patch.upiVpa)) throw new StoreError(400, "Enter a valid UPI ID, e.g. clinic@okbank");
  if (patch.reviewUrl && !/^https:\/\/[^\s]+$/.test(patch.reviewUrl)) throw new StoreError(400, "Review link must start with https://");
  await db
    .update(orgs)
    .set({ name: patch.name, address: patch.address, upiVpa: patch.upiVpa, upiPayee: patch.upiPayee, reviewUrl: patch.reviewUrl })
    .where(eq(orgs.id, actor.orgId));
  await audit(db, actor, actor.orgId, "settings.clinic", "org", actor.orgId);
  return { ok: true };
}

export async function updateDoctor(
  db: Db,
  actor: Actor,
  doctorId: string,
  patch: { feePaise: number; avgConsultMin: number; slotMinutes: number; sessions: string; active: boolean },
) {
  requirePermission(actor, "settings:manage");
  if (!Number.isInteger(patch.feePaise) || patch.feePaise < 0 || patch.feePaise > 10_000_00) throw new StoreError(400, "Fee must be between ₹0 and ₹10,000");
  if (!Number.isInteger(patch.avgConsultMin) || patch.avgConsultMin < 2 || patch.avgConsultMin > 60) throw new StoreError(400, "Average consultation must be 2–60 minutes");
  if (![10, 15, 20, 30, 45, 60].includes(patch.slotMinutes)) throw new StoreError(400, "Slot length must be 10, 15, 20, 30, 45 or 60 minutes");
  if (!isValidSessions(patch.sessions)) throw new StoreError(400, "Sessions look like 10:00-13:00,17:00-20:00");
  const res = await db
    .update(doctors)
    .set(patch)
    .where(and(eq(doctors.orgId, actor.orgId), eq(doctors.id, doctorId)))
    .returning({ id: doctors.id });
  if (res.length === 0) throw notFound("Doctor");
  await audit(db, actor, actor.orgId, "settings.doctor", "doctor", doctorId);
  return { ok: true };
}

export async function listAudit(db: Db, actor: Actor, limit = 100) {
  requirePermission(actor, "audit:view");
  const rows = await db
    .select({ a: auditLog, name: staff.name, role: staff.role })
    .from(auditLog)
    .leftJoin(staff, eq(staff.id, auditLog.staffId))
    .where(eq(auditLog.orgId, actor.orgId))
    .orderBy(desc(auditLog.at))
    .limit(limit);
  return rows.map((r) => ({
    id: r.a.id,
    at: r.a.at.getTime(),
    action: r.a.action,
    entity: r.a.entity,
    entityId: r.a.entityId,
    staffName: r.name ?? "System",
    role: r.role ?? "",
  }));
}
