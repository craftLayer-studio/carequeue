/**
 * Postgres schema (Drizzle). Every business row carries `org_id` and every query filters by it.
 * Money is integer paise. Instants are `timestamptz` (UTC); clinic days are IST `YYYY-MM-DD` text.
 *
 * Patient data is minimal by design: name, phone, age, optional short visit reason. Purpose and
 * retention for each patient-linked table are noted next to it (draft, confirm with counsel).
 */
import { sql } from "drizzle-orm";
import { boolean, index, integer, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

export const orgs = pgTable("orgs", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  kind: text("kind").notNull(), // opd | dental | physio | lab | vet
  city: text("city").notNull(),
  address: text("address").notNull(),
  phone: text("phone").notNull(),
  upiVpa: text("upi_vpa").notNull(),
  upiPayee: text("upi_payee").notNull(),
  /** Unguessable token printed in the reception QR. */
  qrToken: text("qr_token").notNull().unique(),
  reviewUrl: text("review_url"),
  isDemo: boolean("is_demo").notNull().default(false),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const doctors = pgTable(
  "doctors",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id),
    name: text("name").notNull(),
    qualification: text("qualification").notNull(),
    speciality: text("speciality").notNull(),
    registrationNo: text("registration_no").notNull(),
    tokenPrefix: text("token_prefix").notNull(),
    feePaise: integer("fee_paise").notNull(),
    avgConsultMin: integer("avg_consult_min").notNull(),
    slotMinutes: integer("slot_minutes").notNull(),
    sessions: text("sessions").notNull(),
    weeklyOff: integer("weekly_off"),
    active: boolean("active").notNull().default(true),
  },
  (t) => [index("doctors_org_idx").on(t.orgId), uniqueIndex("doctors_prefix_uq").on(t.orgId, t.tokenPrefix)],
);

export const staff = pgTable(
  "staff",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id),
    name: text("name").notNull(),
    phone: text("phone").notNull(),
    role: text("role").notNull(), // owner | receptionist | doctor | assistant
    doctorId: text("doctor_id").references(() => doctors.id),
    active: boolean("active").notNull().default(true),
  },
  (t) => [uniqueIndex("staff_phone_uq").on(t.phone)],
);

/** Staff sign-in codes. Only a hash is stored. Retention: deleted after use or expiry. */
export const otpChallenges = pgTable("otp_challenges", {
  id: text("id").primaryKey(),
  phone: text("phone").notNull(),
  codeHash: text("code_hash").notNull(),
  expiresAt: ts("expires_at").notNull(),
  attempts: integer("attempts").notNull().default(0),
  consumedAt: ts("consumed_at"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

/**
 * The phone holder (CRM key). One per phone per clinic; family members share it.
 * Purpose: contact for service messages and consented reminders. Retention: clinic policy.
 */
export const contacts = pgTable(
  "contacts",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id),
    phone: text("phone").notNull(),
    /** Random token for the self-service "manage messages" / opt-out page. */
    prefsToken: text("prefs_token").notNull().unique(),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("contacts_org_phone_uq").on(t.orgId, t.phone)],
);

/** A person seen by the clinic. Purpose: identify the patient at the counter. Retention: medical records period. */
export const patients = pgTable(
  "patients",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id),
    contactId: text("contact_id")
      .notNull()
      .references(() => contacts.id),
    name: text("name").notNull(),
    nameKey: text("name_key").notNull(),
    age: integer("age").notNull(),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("patients_contact_name_uq").on(t.contactId, t.nameKey), index("patients_org_idx").on(t.orgId)],
);

/** DPDP consent ledger. Append-only; latest row per purpose wins. Retention: life of account + 1 year. */
export const consentRecords = pgTable(
  "consent_records",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id),
    contactId: text("contact_id")
      .notNull()
      .references(() => contacts.id),
    purpose: text("purpose").notNull(), // service | reminders | marketing
    granted: boolean("granted").notNull(),
    noticeVersion: text("notice_version").notNull(),
    channel: text("channel").notNull(), // qr | booking | staff | optout_link
    at: ts("at").notNull().defaultNow(),
  },
  (t) => [index("consent_contact_idx").on(t.orgId, t.contactId)],
);

/** Appointment with a doctor. Retention: medical records period. */
export const appointments = pgTable(
  "appointments",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id),
    doctorId: text("doctor_id")
      .notNull()
      .references(() => doctors.id),
    patientId: text("patient_id")
      .notNull()
      .references(() => patients.id),
    startsAt: ts("starts_at").notNull(),
    status: text("status").notNull(), // booked | checked_in | cancelled | no_show
    publicToken: text("public_token").notNull().unique(),
    reason: text("reason"),
    reminderSentAt: ts("reminder_sent_at"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("appointments_org_doctor_idx").on(t.orgId, t.doctorId, t.startsAt),
    // One live booking per doctor per slot; cancelled ones free the slot.
    uniqueIndex("appointments_slot_uq")
      .on(t.doctorId, t.startsAt)
      .where(sql`status <> 'cancelled'`),
  ],
);

/** Queue token. Retention: 1 year for analytics, then aggregate. */
export const tokens = pgTable(
  "tokens",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id),
    doctorId: text("doctor_id")
      .notNull()
      .references(() => doctors.id),
    patientId: text("patient_id")
      .notNull()
      .references(() => patients.id),
    appointmentId: text("appointment_id").references(() => appointments.id),
    day: text("day").notNull(),
    number: integer("number").notNull(),
    kind: text("kind").notNull(), // walkin | appointment
    priority: text("priority").notNull().default("normal"),
    status: text("status").notNull(),
    reason: text("reason"),
    /** Unguessable id in the patient's live status link. */
    publicToken: text("public_token").notNull().unique(),
    joinedAt: ts("joined_at").notNull(),
    queuedAt: ts("queued_at").notNull(),
    calledAt: ts("called_at"),
    doneAt: ts("done_at"),
    alertedThree: boolean("alerted_three").notNull().default(false),
    alertedNext: boolean("alerted_next").notNull().default(false),
  },
  (t) => [
    uniqueIndex("tokens_number_uq").on(t.orgId, t.doctorId, t.day, t.number),
    index("tokens_org_day_idx").on(t.orgId, t.day),
  ],
);

/** Fee collection. Amount is set by the server from the doctor's fee. Retention: 8 years (accounts). */
export const payments = pgTable(
  "payments",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id),
    tokenId: text("token_id")
      .notNull()
      .references(() => tokens.id),
    amountPaise: integer("amount_paise").notNull(),
    method: text("method").notNull(), // upi | cash
    status: text("status").notNull(), // pending | paid
    reference: text("reference").notNull(),
    collectedBy: text("collected_by").references(() => staff.id),
    createdAt: ts("created_at").notNull().defaultNow(),
    paidAt: ts("paid_at"),
  },
  (t) => [uniqueIndex("payments_token_uq").on(t.tokenId), index("payments_org_idx").on(t.orgId)],
);

/** Follow-up date set by the practitioner. Retention: medical records period. */
export const followUps = pgTable(
  "follow_ups",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id),
    patientId: text("patient_id")
      .notNull()
      .references(() => patients.id),
    doctorId: text("doctor_id")
      .notNull()
      .references(() => doctors.id),
    dueDate: text("due_date").notNull(),
    status: text("status").notNull(), // scheduled | reminded | returned | cancelled
    setBy: text("set_by")
      .notNull()
      .references(() => staff.id),
    remindedAt: ts("reminded_at"),
    returnedAt: ts("returned_at"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("follow_ups_org_idx").on(t.orgId, t.status)],
);

/** Simulated WhatsApp/SMS outbox. Retention: 90 days. */
export const outbox = pgTable(
  "outbox",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id),
    contactId: text("contact_id").references(() => contacts.id),
    channel: text("channel").notNull(), // whatsapp | sms
    toPhone: text("to_phone").notNull(),
    template: text("template").notNull(),
    purpose: text("purpose").notNull(),
    body: text("body").notNull(),
    status: text("status").notNull(), // sent | skipped_no_consent
    adapter: text("adapter").notNull(),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("outbox_org_idx").on(t.orgId, t.createdAt)],
);

/** Access log for patient record views and sensitive actions. Retention: at least 1 year. */
export const auditLog = pgTable(
  "audit_log",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id),
    staffId: text("staff_id").references(() => staff.id),
    action: text("action").notNull(),
    entity: text("entity").notNull(),
    entityId: text("entity_id").notNull(),
    ip: text("ip"),
    at: ts("at").notNull().defaultNow(),
  },
  (t) => [index("audit_org_idx").on(t.orgId, t.at)],
);
