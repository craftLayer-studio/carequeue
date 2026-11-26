/**
 * Demo data: one fictional clinic ("Demo") with Indian names, phones and INR fees.
 * Not a real business. Phone numbers are placeholders in the 70000 xxxxx block.
 */
import { sql } from "drizzle-orm";
import { addDays, istDateTime, istDay, nameKey, NOTICE_VERSION, renderMessage, tokenLabel, type IsoDay } from "@/domain";
import { appUrl } from "../config";
import type { Db } from "./client";
import * as s from "./schema";
import { newId, randomToken } from "../store/ids";

export const DEMO_ORG_ID = "org_demo";

export const DEMO_STAFF = [
  { id: "stf_owner", name: "Dr. Anjali Mehta", phone: "+917000090001", role: "owner", doctorId: "doc_mehta" },
  { id: "stf_recep", name: "Sunita Yadav", phone: "+917000090002", role: "receptionist", doctorId: null },
  { id: "stf_mehta", name: "Dr. Anjali Mehta (consulting)", phone: "+917000090003", role: "doctor", doctorId: "doc_mehta" },
  { id: "stf_iyer", name: "Dr. Kavita Iyer", phone: "+917000090004", role: "doctor", doctorId: "doc_iyer" },
  { id: "stf_asst", name: "Imran Khan", phone: "+917000090005", role: "assistant", doctorId: null },
] as const;

const FIRST = ["Ramesh", "Sunita", "Arjun", "Priya", "Mohd. Salim", "Kavya", "Rajesh", "Neha", "Suresh", "Pooja", "Vikram", "Anita", "Farhan", "Meena", "Harish", "Lakshmi", "Deepak", "Shabana", "Gaurav", "Ritu", "Manoj", "Asha", "Sanjay", "Divya", "Imtiaz", "Rekha"];
const LAST = ["Verma", "Sharma", "Gupta", "Srivastava", "Khan", "Mishra", "Yadav", "Singh", "Pandey", "Tiwari", "Agarwal", "Rizvi", "Saxena", "Chauhan"];
const REASONS = [null, null, "Fever since 2 days", "Follow-up visit", "BP check", "Report review", "Cough and cold", null, "Knee pain", "Back pain session", null, "Sugar test review"];

/** Small deterministic PRNG so the demo looks the same on every reseed. */
function rng(seed: number) {
  let x = seed >>> 0;
  return () => {
    x = (x * 1664525 + 1013904223) >>> 0;
    return x / 2 ** 32;
  };
}

export async function isEmpty(db: Db): Promise<boolean> {
  const rows = await db.select({ id: s.orgs.id }).from(s.orgs).limit(1);
  return rows.length === 0;
}

export async function seedIfEmpty(db: Db, now = new Date()): Promise<boolean> {
  if (!(await isEmpty(db))) return false;
  await seedDemo(db, now);
  return true;
}

export async function resetDatabase(db: Db): Promise<void> {
  await db.execute(
    sql`TRUNCATE audit_log, outbox, follow_ups, payments, tokens, appointments, consent_records, patients, contacts, otp_challenges, staff, doctors, orgs CASCADE`,
  );
}

export async function seedDemo(db: Db, now = new Date()): Promise<{ qrToken: string }> {
  const r = rng(20261125);
  const pick = <T,>(list: readonly T[]) => list[Math.floor(r() * list.length)];
  const qrToken = randomToken();
  const today = istDay(now);

  await db.transaction(async (tx) => {
    await tx.insert(s.orgs).values({
      id: DEMO_ORG_ID,
      name: "Sukoon Family Clinic (Demo)",
      kind: "opd",
      city: "Lucknow",
      address: "12 Demo Lane, Gomti Nagar, Lucknow 226010 (fictional)",
      phone: "+917000000100",
      upiVpa: "sukoon.demo@okdemo",
      upiPayee: "Sukoon Family Clinic Demo",
      qrToken,
      reviewUrl: "https://example.com/demo-review",
      isDemo: true,
      createdAt: new Date(now.getTime() - 30 * 86_400_000),
    });

    const doctorRows = [
      { id: "doc_mehta", name: "Dr. Anjali Mehta", qualification: "MBBS, MD (Medicine)", speciality: "General physician", registrationNo: "UPMC-DEMO-10231", tokenPrefix: "A", feePaise: 50000, avgConsultMin: 7, slotMinutes: 15, sessions: "09:30-13:30,17:00-20:00", weeklyOff: 0 },
      { id: "doc_iyer", name: "Dr. Kavita Iyer", qualification: "BPT, MPT (Ortho)", speciality: "Physiotherapist", registrationNo: "UPPT-DEMO-2207", tokenPrefix: "P", feePaise: 70000, avgConsultMin: 20, slotMinutes: 30, sessions: "10:00-14:00,16:00-19:00", weeklyOff: 0 },
    ];
    await tx.insert(s.doctors).values(doctorRows.map((d) => ({ ...d, orgId: DEMO_ORG_ID, active: true })));
    await tx.insert(s.staff).values(DEMO_STAFF.map((m) => ({ ...m, orgId: DEMO_ORG_ID, active: true })));

    // Patients and consent.
    const people: { contactId: string; patientId: string; name: string; phone: string; reminders: boolean; marketing: boolean; prefs: string }[] = [];
    const contactRows: (typeof s.contacts.$inferInsert)[] = [];
    const patientRows: (typeof s.patients.$inferInsert)[] = [];
    const consentRows: (typeof s.consentRecords.$inferInsert)[] = [];
    for (let i = 0; i < 48; i++) {
      const name = `${FIRST[i % FIRST.length]} ${pick(LAST)}`;
      const phone = `+9170000${String(10 + i).padStart(5, "0")}`;
      const contactId = newId("con");
      const patientId = newId("pat");
      const since = new Date(now.getTime() - (8 + Math.floor(r() * 20)) * 86_400_000);
      const reminders = r() < 0.7;
      const marketing = r() < 0.35;
      const prefs = randomToken();
      contactRows.push({ id: contactId, orgId: DEMO_ORG_ID, phone, prefsToken: prefs, createdAt: since });
      patientRows.push({ id: patientId, orgId: DEMO_ORG_ID, contactId, name, nameKey: nameKey(name), age: 4 + Math.floor(r() * 74), createdAt: since });
      for (const [purpose, granted] of [["service", true], ["reminders", reminders], ["marketing", marketing]] as const) {
        consentRows.push({ id: newId("cns"), orgId: DEMO_ORG_ID, contactId, purpose, granted, noticeVersion: NOTICE_VERSION, channel: i % 5 === 0 ? "staff" : "qr", at: since });
      }
      people.push({ contactId, patientId, name, phone, reminders, marketing, prefs });
    }
    // A family member sharing a phone.
    const child = { id: newId("pat"), orgId: DEMO_ORG_ID, contactId: people[0].contactId, name: "Aarav Verma", nameKey: nameKey("Aarav Verma"), age: 7, createdAt: now };
    patientRows.push(child);
    await tx.insert(s.contacts).values(contactRows);
    await tx.insert(s.patients).values(patientRows);
    await tx.insert(s.consentRecords).values(consentRows);

    // History: last 6 days of tokens with payments.
    const tokenRows: (typeof s.tokens.$inferInsert)[] = [];
    const paymentRows: (typeof s.payments.$inferInsert)[] = [];
    for (let back = 6; back >= 1; back--) {
      const day: IsoDay = addDays(today, -back);
      if (new Date(`${day}T00:00:00Z`).getUTCDay() === 0) continue;
      for (const d of doctorRows) {
        const count = d.id === "doc_mehta" ? 16 + Math.floor(r() * 10) : 5 + Math.floor(r() * 4);
        let clock = istDateTime(day, "09:40").getTime();
        for (let n = 1; n <= count; n++) {
          const person = pick(people);
          const joinedAt = new Date(clock);
          const wait = (10 + Math.floor(r() * 35)) * 60_000;
          const consult = (d.avgConsultMin - 2 + Math.floor(r() * 5)) * 60_000;
          const noShow = r() < 0.07;
          const id = newId("tok");
          tokenRows.push({
            id,
            orgId: DEMO_ORG_ID,
            doctorId: d.id,
            patientId: person.patientId,
            day,
            number: n,
            kind: r() < 0.25 ? "appointment" : "walkin",
            priority: r() < 0.1 ? "elderly" : "normal",
            status: noShow ? "no_show" : "done",
            reason: pick(REASONS),
            publicToken: randomToken(),
            joinedAt,
            queuedAt: joinedAt,
            calledAt: noShow ? null : new Date(clock + wait),
            doneAt: noShow ? null : new Date(clock + wait + consult),
            alertedThree: true,
            alertedNext: true,
          });
          if (!noShow) {
            const upi = r() < 0.6;
            paymentRows.push({
              id: newId("pay"),
              orgId: DEMO_ORG_ID,
              tokenId: id,
              amountPaise: d.feePaise,
              method: upi ? "upi" : "cash",
              status: "paid",
              reference: `CQ${day.replace(/-/g, "")}${d.tokenPrefix}${n}`,
              collectedBy: "stf_recep",
              createdAt: new Date(clock + wait + consult),
              paidAt: new Date(clock + wait + consult),
            });
          }
          clock += (6 + Math.floor(r() * 10)) * 60_000;
        }
      }
    }

    // Today: some seen, one with the doctor, several waiting (relative to now).
    const todayPlan: { doctor: (typeof doctorRows)[number]; done: number; waiting: number }[] = [
      { doctor: doctorRows[0], done: 6, waiting: 6 },
      { doctor: doctorRows[1], done: 2, waiting: 2 },
    ];
    const outboxRows: (typeof s.outbox.$inferInsert)[] = [];
    const used = new Set<string>();
    for (const plan of todayPlan) {
      const d = plan.doctor;
      const total = plan.done + 1 + plan.waiting;
      for (let n = 1; n <= total; n++) {
        let person = pick(people);
        while (used.has(person.patientId)) person = pick(people);
        used.add(person.patientId);
        const minutesAgo = (total - n + 1) * (d.avgConsultMin + 2) + 5;
        const joinedAt = new Date(now.getTime() - minutesAgo * 60_000);
        const isDone = n <= plan.done;
        const isCurrent = n === plan.done + 1;
        const calledAt = isDone ? new Date(joinedAt.getTime() + 14 * 60_000) : isCurrent ? new Date(now.getTime() - 3 * 60_000) : null;
        const id = newId("tok");
        const publicToken = randomToken();
        tokenRows.push({
          id,
          orgId: DEMO_ORG_ID,
          doctorId: d.id,
          patientId: person.patientId,
          day: today,
          number: n,
          kind: "walkin",
          priority: n === total - 1 ? "elderly" : "normal",
          status: isDone ? "done" : isCurrent ? "called" : "waiting",
          reason: pick(REASONS),
          publicToken,
          joinedAt,
          queuedAt: joinedAt,
          calledAt,
          doneAt: isDone ? new Date(calledAt!.getTime() + d.avgConsultMin * 60_000) : null,
          alertedThree: n <= plan.done + 4,
          alertedNext: n <= plan.done + 2,
        });
        if (isDone) {
          paymentRows.push({
            id: newId("pay"),
            orgId: DEMO_ORG_ID,
            tokenId: id,
            amountPaise: d.feePaise,
            method: n % 2 === 0 ? "cash" : "upi",
            status: n === plan.done ? "pending" : "paid",
            reference: `CQ${today.replace(/-/g, "")}${d.tokenPrefix}${n}`,
            collectedBy: "stf_recep",
            createdAt: now,
            paidAt: n === plan.done ? null : now,
          });
        }
        outboxRows.push({
          id: newId("msg"),
          orgId: DEMO_ORG_ID,
          contactId: person.contactId,
          channel: "whatsapp",
          toPhone: person.phone,
          template: "token_issued",
          purpose: "service",
          body: renderMessage("token_issued", {
            clinic: "Sukoon Family Clinic (Demo)",
            patient: person.name,
            doctor: d.name,
            token: tokenLabel(d.tokenPrefix, n),
            link: `${appUrl()}/s/${publicToken}`,
          }),
          status: "sent",
          adapter: "simulated-whatsapp",
          createdAt: joinedAt,
        });
      }
    }
    await tx.insert(s.tokens).values(tokenRows);
    await tx.insert(s.payments).values(paymentRows);
    await tx.insert(s.outbox).values(outboxRows);

    // Appointments: a few later today and in the coming days, plus one past no-show.
    const apptRows: (typeof s.appointments.$inferInsert)[] = [];
    const slotsAhead: [number, string, string][] = [
      [0, "19:00", "doc_mehta"],
      [0, "19:30", "doc_mehta"],
      [1, "10:00", "doc_mehta"],
      [1, "10:30", "doc_iyer"],
      [2, "17:15", "doc_mehta"],
      [3, "11:00", "doc_iyer"],
    ];
    slotsAhead.forEach(([plus, time, doctorId], i) => {
      const day = addDays(today, plus);
      if (new Date(`${day}T00:00:00Z`).getUTCDay() === 0) return;
      const startsAt = istDateTime(day, time);
      if (startsAt.getTime() < now.getTime()) return;
      const person = people[20 + i];
      apptRows.push({ id: newId("apt"), orgId: DEMO_ORG_ID, doctorId, patientId: person.patientId, startsAt, status: "booked", publicToken: randomToken(), reason: i % 2 ? "Follow-up visit" : null, createdAt: now });
    });
    apptRows.push({
      id: newId("apt"),
      orgId: DEMO_ORG_ID,
      doctorId: "doc_iyer",
      patientId: people[30].patientId,
      startsAt: istDateTime(addDays(today, -2), "11:00"),
      status: "no_show",
      publicToken: randomToken(),
      reason: null,
      createdAt: now,
    });
    await tx.insert(s.appointments).values(apptRows);

    // Follow-ups set by doctors: some due soon (reminders will go out), one returned.
    await tx.insert(s.followUps).values([
      { id: newId("fup"), orgId: DEMO_ORG_ID, patientId: people[3].patientId, doctorId: "doc_mehta", dueDate: addDays(today, 1), status: "scheduled", setBy: "stf_mehta", createdAt: now },
      { id: newId("fup"), orgId: DEMO_ORG_ID, patientId: people[4].patientId, doctorId: "doc_mehta", dueDate: addDays(today, 2), status: "scheduled", setBy: "stf_mehta", createdAt: now },
      { id: newId("fup"), orgId: DEMO_ORG_ID, patientId: people[5].patientId, doctorId: "doc_iyer", dueDate: addDays(today, 2), status: "scheduled", setBy: "stf_iyer", createdAt: now },
      { id: newId("fup"), orgId: DEMO_ORG_ID, patientId: people[6].patientId, doctorId: "doc_mehta", dueDate: addDays(today, 10), status: "scheduled", setBy: "stf_mehta", createdAt: now },
      { id: newId("fup"), orgId: DEMO_ORG_ID, patientId: people[7].patientId, doctorId: "doc_iyer", dueDate: addDays(today, -3), status: "returned", setBy: "stf_iyer", remindedAt: new Date(now.getTime() - 5 * 86_400_000), returnedAt: new Date(now.getTime() - 3 * 86_400_000), createdAt: now },
    ]);
  });
  return { qrToken };
}

/** The demo clinic's reception QR token (for the landing page "Try the demo" links). */
export async function demoQrToken(db: Db): Promise<string | null> {
  const rows = await db.select({ qr: s.orgs.qrToken }).from(s.orgs).where(sql`${s.orgs.id} = ${DEMO_ORG_ID}`);
  return rows[0]?.qr ?? null;
}
