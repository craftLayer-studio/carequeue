import { beforeEach, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { istDateTime, type Registration } from "@/domain";
import { createMemoryDb, type Db } from "../db/client";
import * as s from "../db/schema";
import { DEMO_ORG_ID, DEMO_STAFF, seedDemo } from "../db/seed";
import {
  actOnToken,
  actorForStaff,
  addWalkIn,
  bookAppointment,
  callNext,
  checkInByPatient,
  collectFee,
  confirmUpi,
  dashboard,
  joinFromQr,
  listAudit,
  prefsByToken,
  requestOtp,
  searchPatients,
  sendClinicNotice,
  sendDueReminders,
  setFollowUp,
  staffQueues,
  tokenStatus,
  updatePrefsByToken,
  verifyOtp,
  viewPatient,
  type Actor,
} from "./index";

// Tuesday 24 Nov 2026, 10:00 IST
const NOW = istDateTime("2026-11-24", "10:00");
const later = (min: number) => new Date(NOW.getTime() + min * 60_000);

const ALL = { service: true, reminders: true, marketing: true };
const SERVICE_ONLY = { service: true, reminders: false, marketing: false };

function reg(name: string, phone: string, age = 40): Registration {
  return { name, phone, age, reason: null };
}

let db: Db;
let qr: string;
const actors = {} as Record<"owner" | "recep" | "doctor" | "physio" | "asst", Actor>;

async function setupClinic(database: Db, orgId: string, phoneBase: number) {
  const qrToken = `qr-${orgId}-0123456789abcdef`;
  await database.insert(s.orgs).values({
    id: orgId,
    name: `Test Clinic ${orgId}`,
    kind: "opd",
    city: "Pune",
    address: "1 Test Road",
    phone: "+917000000100",
    upiVpa: "test.clinic@okdemo",
    upiPayee: "Test Clinic",
    qrToken,
    reviewUrl: "https://example.com/review",
  });
  await database.insert(s.doctors).values([
    { id: `${orgId}_gp`, orgId, name: "Dr. Neha Joshi", qualification: "MBBS", speciality: "GP", registrationNo: "MMC-1", tokenPrefix: "A", feePaise: 50000, avgConsultMin: 8, slotMinutes: 15, sessions: "09:00-13:00", weeklyOff: 0 },
    { id: `${orgId}_pt`, orgId, name: "Dr. Om Patil", qualification: "BPT", speciality: "Physio", registrationNo: "PT-1", tokenPrefix: "P", feePaise: 70000, avgConsultMin: 20, slotMinutes: 30, sessions: "10:00-12:00", weeklyOff: 0 },
  ]);
  const p = (n: number) => `+9170000${String(phoneBase + n).padStart(5, "0")}`;
  await database.insert(s.staff).values([
    { id: `${orgId}_owner`, orgId, name: "Owner", phone: p(1), role: "owner" },
    { id: `${orgId}_recep`, orgId, name: "Reception", phone: p(2), role: "receptionist" },
    { id: `${orgId}_doc`, orgId, name: "Dr. Neha Joshi", phone: p(3), role: "doctor", doctorId: `${orgId}_gp` },
    { id: `${orgId}_physio`, orgId, name: "Dr. Om Patil", phone: p(4), role: "doctor", doctorId: `${orgId}_pt` },
    { id: `${orgId}_asst`, orgId, name: "Assistant", phone: p(5), role: "assistant" },
  ]);
  return qrToken;
}

beforeEach(async () => {
  db = await createMemoryDb();
  qr = await setupClinic(db, "org_t", 90000);
  actors.owner = (await actorForStaff(db, "org_t_owner"))!;
  actors.recep = (await actorForStaff(db, "org_t_recep"))!;
  actors.doctor = (await actorForStaff(db, "org_t_doc"))!;
  actors.physio = (await actorForStaff(db, "org_t_physio"))!;
  actors.asst = (await actorForStaff(db, "org_t_asst"))!;
});

async function outboxFor(template: string) {
  return db.select().from(s.outbox).where(and(eq(s.outbox.orgId, "org_t"), eq(s.outbox.template, template)));
}

describe("QR self-registration and live status", () => {
  it("issues a token, records consent and sends the WhatsApp link", async () => {
    const { publicToken } = await joinFromQr(db, qr, { doctorId: "org_t_gp", registration: reg("Ramesh Verma", "98765 43210", 62), consent: { service: true, reminders: true, marketing: false } }, NOW);
    const status = await tokenStatus(db, publicToken, NOW);
    expect(status.token).toMatchObject({ label: "A-01", status: "waiting", ahead: 0, etaMinutes: 0 });
    expect(JSON.stringify(status)).not.toContain("98765");

    const consents = await db.select().from(s.consentRecords);
    expect(consents.map((c) => [c.purpose, c.granted, c.channel]).sort()).toEqual([
      ["marketing", false, "qr"],
      ["reminders", true, "qr"],
      ["service", true, "qr"],
    ]);
    const [msg] = await outboxFor("token_issued");
    expect(msg).toMatchObject({ status: "sent", toPhone: "+919876543210", adapter: "simulated-whatsapp" });
    expect(msg.body).toContain(`/s/${publicToken}`);
  });

  it("requires service consent and validates the clinic token", async () => {
    await expect(joinFromQr(db, qr, { doctorId: "org_t_gp", registration: reg("Asha", "9876500001"), consent: { service: false, reminders: true, marketing: true } }, NOW)).rejects.toThrow(/agree/);
    await expect(joinFromQr(db, "wrong", { doctorId: "org_t_gp", registration: reg("Asha", "9876500001"), consent: ALL }, NOW)).rejects.toThrow(/not found/);
  });

  it("returns the same token if the patient scans twice, and keeps family members separate", async () => {
    const a = await joinFromQr(db, qr, { doctorId: "org_t_gp", registration: reg("Asha Rao", "9876500001"), consent: ALL }, NOW);
    const b = await joinFromQr(db, qr, { doctorId: "org_t_gp", registration: reg("asha  rao", "9876500001"), consent: ALL }, later(1));
    const c = await joinFromQr(db, qr, { doctorId: "org_t_gp", registration: reg("Aarav Rao", "9876500001", 6), consent: ALL }, later(2));
    expect(b.publicToken).toBe(a.publicToken);
    expect(c.publicToken).not.toBe(a.publicToken);
    expect(await db.select().from(s.contacts)).toHaveLength(1);
    expect(await db.select().from(s.patients)).toHaveLength(2);
  });

  it("estimates wait from position and sends turn alerts once", async () => {
    const tokens: string[] = [];
    for (let i = 0; i < 5; i++) {
      tokens.push((await joinFromQr(db, qr, { doctorId: "org_t_gp", registration: reg(`Patient ${"ABCDE"[i]}`, `98765000${10 + i}`), consent: SERVICE_ONLY }, later(i))).publicToken);
    }
    let last = await tokenStatus(db, tokens[4], later(5));
    expect(last.token).toMatchObject({ ahead: 4, etaMinutes: 32 });
    expect(await outboxFor("turn_next")).toHaveLength(1);
    expect(await outboxFor("turn_three_ahead")).toHaveLength(3);

    await callNext(db, actors.recep, "org_t_gp", later(6));
    last = await tokenStatus(db, tokens[4], later(8));
    expect(last.token).toMatchObject({ ahead: 3, nowServing: "A-01", etaMinutes: 3 * 8 + 6 });
    expect(await outboxFor("turn_next")).toHaveLength(2);
    expect(await outboxFor("turn_three_ahead")).toHaveLength(4);
  });
});

describe("staff queue screen", () => {
  async function three() {
    for (const [i, name] of ["Ravi Kumar", "Seema Das", "Gopal Nair"].entries()) {
      await joinFromQr(db, qr, { doctorId: "org_t_gp", registration: reg(name, `98765111${10 + i}`), consent: SERVICE_ONLY }, later(i));
    }
  }

  it("calls next, finishing the current patient, and skips and requeues", async () => {
    await three();
    expect((await callNext(db, actors.recep, "org_t_gp", later(5))).called).toBe("A-01");
    expect((await callNext(db, actors.recep, "org_t_gp", later(12))).called).toBe("A-02");
    let q = (await staffQueues(db, actors.recep, later(12))).queues[0];
    expect(q.current?.label).toBe("A-02");
    expect(q.finished.map((t) => [t.label, t.status])).toEqual([["A-01", "done"]]);

    await actOnToken(db, actors.recep, q.current!.id, "skip", later(13));
    q = (await staffQueues(db, actors.recep, later(13))).queues[0];
    expect(q.skipped.map((t) => t.label)).toEqual(["A-02"]);
    await actOnToken(db, actors.recep, q.skipped[0].id, "requeue", later(14));
    q = (await staffQueues(db, actors.recep, later(14))).queues[0];
    expect(q.waiting.map((t) => t.label)).toEqual(["A-03", "A-02"]);

    await actOnToken(db, actors.recep, q.waiting[0].id, "no_show", later(15));
    await expect(actOnToken(db, actors.recep, q.waiting[0].id, "done", later(16))).rejects.toThrow(/Cannot/);
  });

  it("puts elderly and urgent patients ahead when staff add them", async () => {
    await three();
    await addWalkIn(db, actors.recep, { doctorId: "org_t_gp", registration: reg("Kamla Devi", "9876522222", 81), consent: SERVICE_ONLY, priority: "elderly" }, later(4));
    const q = (await staffQueues(db, actors.recep, later(4))).queues[0];
    expect(q.waiting[0]).toMatchObject({ patientName: "Kamla Devi", priority: "elderly", ahead: 0 });
  });

  it("restricts doctors to their own queue", async () => {
    await three();
    await expect(callNext(db, actors.physio, "org_t_gp", later(5))).rejects.toThrow(/own queue/);
    expect((await staffQueues(db, actors.physio, later(5))).queues.map((q) => q.doctor.id)).toEqual(["org_t_pt"]);
  });

  it("masks phones unless the viewer is a receptionist or doctor", async () => {
    await three();
    const asstView = (await staffQueues(db, actors.asst, later(5))).queues[0].waiting[0];
    const recepView = (await staffQueues(db, actors.recep, later(5))).queues[0].waiting[0];
    const ownerView = (await staffQueues(db, actors.owner, later(5))).queues[0].waiting[0];
    expect(asstView).toMatchObject({ phone: "+91 98XXX XX110", masked: true });
    expect(ownerView.masked).toBe(true);
    expect(recepView).toMatchObject({ phone: "+91 98765 11110", masked: false });
  });
});

describe("patient records and audit", () => {
  it("logs every record view and masks by role", async () => {
    await joinFromQr(db, qr, { doctorId: "org_t_gp", registration: reg("Ravi Kumar", "9876511110"), consent: ALL }, NOW);
    const [found] = await searchPatients(db, actors.asst, "ravi");
    expect(found.masked).toBe(true);
    const asst = await viewPatient(db, actors.asst, found.id, "10.0.0.1", NOW);
    expect(asst.contact).toEqual({ phone: "+91 98XXX XX110", masked: true });
    const doc = await viewPatient(db, actors.doctor, found.id, null, NOW);
    expect(doc.contact.masked).toBe(false);
    expect(doc.consent).toEqual({ service: true, reminders: true, marketing: true });
    const log = (await listAudit(db, actors.owner)).filter((a) => a.action === "patient.view");
    expect(log).toHaveLength(2);
    await expect(listAudit(db, actors.recep)).rejects.toThrow(/permission/);
  });

  it("does not leak across clinics", async () => {
    const other = await setupClinic(db, "org_x", 80000);
    const { publicToken } = await joinFromQr(db, other, { doctorId: "org_x_gp", registration: reg("Other Person", "9876533333"), consent: ALL }, NOW);
    const [tok] = await db.select().from(s.tokens).where(eq(s.tokens.publicToken, publicToken));
    await expect(actOnToken(db, actors.recep, tok.id, "call", NOW)).rejects.toThrow(/not found/);
    await expect(viewPatient(db, actors.recep, tok.patientId, null, NOW)).rejects.toThrow(/not found/);
    expect(await searchPatients(db, actors.recep, "Other")).toEqual([]);
  });
});

describe("fees", () => {
  it("takes the amount from the doctor's fee and confirms UPI by hand", async () => {
    const { publicToken } = await joinFromQr(db, qr, { doctorId: "org_t_gp", registration: reg("Ravi Kumar", "9876511110"), consent: SERVICE_ONLY }, NOW);
    const [tok] = await db.select().from(s.tokens).where(eq(s.tokens.publicToken, publicToken));
    await expect(collectFee(db, actors.asst, tok.id, "upi", NOW)).rejects.toThrow(/permission/);
    const upi = await collectFee(db, actors.recep, tok.id, "upi", NOW);
    expect(upi).toMatchObject({ status: "pending", amount: "₹500" });
    expect(upi.upiLink).toMatch(/^upi:\/\/pay\?pa=test.clinic%40okdemo&.*am=500.00/);
    expect((await tokenStatus(db, publicToken, NOW)).payment).toMatchObject({ status: "pending", amount: "₹500" });
    await confirmUpi(db, actors.recep, tok.id, NOW);
    await expect(collectFee(db, actors.recep, tok.id, "cash", NOW)).rejects.toThrow(/already/);
    expect(await outboxFor("payment_receipt")).toHaveLength(1);
  });

  it("records cash as paid immediately", async () => {
    const { publicToken } = await joinFromQr(db, qr, { doctorId: "org_t_pt", registration: reg("Ravi Kumar", "9876511110"), consent: SERVICE_ONLY }, NOW);
    const [tok] = await db.select().from(s.tokens).where(eq(s.tokens.publicToken, publicToken));
    expect(await collectFee(db, actors.owner, tok.id, "cash", NOW)).toMatchObject({ status: "paid", amount: "₹700", upiLink: null });
  });
});

describe("appointments", () => {
  const slot = istDateTime("2026-11-25", "10:30");

  it("books a free slot once, then checks in on the day", async () => {
    const { publicToken } = await bookAppointment(db, qr, { doctorId: "org_t_gp", startsAt: slot, registration: reg("Divya Shah", "9876544444"), consent: SERVICE_ONLY }, NOW);
    await expect(bookAppointment(db, qr, { doctorId: "org_t_gp", startsAt: slot, registration: reg("Other", "9876544445"), consent: SERVICE_ONLY }, NOW)).rejects.toThrow(/no longer available/);
    await expect(bookAppointment(db, qr, { doctorId: "org_t_gp", startsAt: istDateTime("2026-11-25", "10:31"), registration: reg("Other", "9876544445"), consent: SERVICE_ONLY }, NOW)).rejects.toThrow(/no longer available/);
    expect(await outboxFor("appointment_booked")).toHaveLength(1);

    await expect(checkInByPatient(db, publicToken, NOW)).rejects.toThrow(/day of the appointment/);
    const { statusPath } = await checkInByPatient(db, publicToken, istDateTime("2026-11-25", "10:20"));
    const status = await tokenStatus(db, statusPath.slice(3), istDateTime("2026-11-25", "10:20"));
    expect(status.token).toMatchObject({ label: "A-01", status: "waiting" });
    await expect(checkInByPatient(db, publicToken, istDateTime("2026-11-25", "10:21"))).rejects.toThrow(/Already/);
  });
});

describe("follow-ups, reminders and consent", () => {
  async function patientId(name: string, phone: string, consent = ALL) {
    await joinFromQr(db, qr, { doctorId: "org_t_gp", registration: reg(name, phone), consent }, NOW);
    const [p] = await db.select().from(s.patients).where(eq(s.patients.name, name));
    return p.id;
  }

  it("lets doctors set follow-ups and sends reminders only with consent", async () => {
    const yes = await patientId("Ravi Kumar", "9876511110", ALL);
    const no = await patientId("Seema Das", "9876511111", SERVICE_ONLY);
    await expect(setFollowUp(db, actors.recep, yes, "org_t_gp", "2026-11-26", NOW)).rejects.toThrow(/permission/);
    await expect(setFollowUp(db, actors.physio, yes, "org_t_gp", "2026-11-26", NOW)).rejects.toThrow(/only for themselves/);
    await expect(setFollowUp(db, actors.doctor, yes, "org_t_gp", "2026-11-24", NOW)).rejects.toThrow(/after today/);
    await setFollowUp(db, actors.doctor, yes, "org_t_gp", "2026-11-26", NOW);
    await setFollowUp(db, actors.doctor, no, "org_t_gp", "2026-11-26", NOW);
    await setFollowUp(db, actors.doctor, no, "org_t_gp", "2026-12-20", NOW);

    const res = await sendDueReminders(db, actors.recep, NOW);
    expect(res).toEqual({ sent: 1, skippedNoConsent: 0 });
    const msgs = await outboxFor("followup_reminder");
    expect(msgs).toHaveLength(1);
    expect(msgs[0].body).toMatch(/Stop these messages: .*\/m\//);
    expect((await sendDueReminders(db, actors.recep, NOW)).sent).toBe(0);

    // Patient comes back: follow-up counts as returned on the dashboard.
    await joinFromQr(db, qr, { doctorId: "org_t_pt", registration: reg("Ravi Kumar", "9876511110"), consent: ALL }, later(60));
    expect((await dashboard(db, actors.owner, later(60))).followUps).toMatchObject({ reminded: 1, returned: 1 });
  });

  it("stops reminders after opt-out from the message link", async () => {
    const id = await patientId("Ravi Kumar", "9876511110", ALL);
    const [contact] = await db.select().from(s.contacts);
    await updatePrefsByToken(db, contact.prefsToken, { reminders: false, marketing: false }, later(1));
    expect((await prefsByToken(db, contact.prefsToken)).consent).toEqual({ service: true, reminders: false, marketing: false });
    await setFollowUp(db, actors.doctor, id, "org_t_gp", "2026-11-25", NOW);
    expect(await sendDueReminders(db, actors.recep, later(2))).toEqual({ sent: 0, skippedNoConsent: 1 });
    const [skipped] = await outboxFor("followup_reminder");
    expect(skipped.status).toBe("skipped_no_consent");
  });

  it("sends practitioner-approved clinic notices only to opted-in contacts and blocks offers", async () => {
    await patientId("Ravi Kumar", "9876511110", ALL);
    await patientId("Seema Das", "9876511111", SERVICE_ONLY);
    await expect(sendClinicNotice(db, actors.owner, "Free eye check-up camp on Sunday 10 am to 1 pm.", false, NOW)).rejects.toThrow(/approve/);
    await expect(sendClinicNotice(db, actors.owner, "Flat 20% off on all consultations this week", true, NOW)).rejects.toThrow(/offers/);
    await expect(sendClinicNotice(db, actors.recep, "Free eye check-up camp on Sunday 10 am to 1 pm.", true, NOW)).rejects.toThrow(/permission/);
    expect(await sendClinicNotice(db, actors.owner, "Free eye check-up camp on Sunday 10 am to 1 pm.", true, NOW)).toEqual({ sent: 1, audience: 2 });
  });
});

describe("staff sign-in", () => {
  it("signs in with a one-time code and rejects wrong or reused codes", async () => {
    expect(await requestOtp(db, "9999999999", NOW)).toEqual({ demoCode: null });
    const { demoCode } = await requestOtp(db, "70000 90002", NOW);
    expect(demoCode).toMatch(/^\d{6}$/);
    const wrong = demoCode === "000000" ? "111111" : "000000";
    await expect(verifyOtp(db, "7000090002", wrong, NOW)).rejects.toThrow(/wrong/);
    const actor = await verifyOtp(db, "7000090002", demoCode!, NOW);
    expect(actor).toMatchObject({ role: "receptionist", orgId: "org_t" });
    await expect(verifyOtp(db, "7000090002", demoCode!, NOW)).rejects.toThrow(/wrong/);
  });

  it("expires codes", async () => {
    const { demoCode } = await requestOtp(db, "7000090002", NOW);
    await expect(verifyOtp(db, "7000090002", demoCode!, later(6))).rejects.toThrow(/expired/);
  });
});

describe("demo seed", () => {
  it("seeds a labelled demo clinic with history for the dashboard", async () => {
    const fresh = await createMemoryDb();
    const { qrToken } = await seedDemo(fresh, NOW);
    expect(qrToken.length).toBeGreaterThanOrEqual(20);
    const owner = (await actorForStaff(fresh, DEMO_STAFF[0].id))!;
    const d = await dashboard(fresh, owner, NOW);
    expect(d.days).toHaveLength(7);
    expect(d.week.patients).toBeGreaterThan(50);
    expect(d.today.patients).toBe(18);
    expect(d.week.avgWaitMin).toBeGreaterThan(0);
    const [org] = await fresh.select().from(s.orgs).where(eq(s.orgs.id, DEMO_ORG_ID));
    expect(org.isDemo).toBe(true);
    expect(org.name).toContain("Demo");
    const q = await staffQueues(fresh, (await actorForStaff(fresh, "stf_recep"))!, NOW);
    expect(q.queues[0].current).not.toBeNull();
    expect(q.queues[0].waiting.length).toBe(6);
  });
});
