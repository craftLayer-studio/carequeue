/**
 * Staff sign-in with phone + one-time code. In this MVP there is no SMS provider: the code is
 * returned to the caller and shown on screen, labelled demo.
 */
import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { and, desc, eq, isNull } from "drizzle-orm";
import { isRole, normalizeIndianMobile, type Role } from "@/domain";
import type { Db } from "../db/client";
import { otpChallenges, staff } from "../db/schema";
import { StoreError } from "./errors";
import { newId } from "./ids";

export const OTP_TTL_MS = 5 * 60_000;
export const OTP_MAX_ATTEMPTS = 5;

export interface Actor {
  staffId: string;
  orgId: string;
  name: string;
  role: Role;
  doctorId: string | null;
}

function hashCode(phone: string, code: string): string {
  return createHash("sha256").update(`${phone}:${code}`).digest("hex");
}

/** Start a sign-in. Returns the demo code only when the phone belongs to active staff. */
export async function requestOtp(db: Db, phoneInput: string, now = new Date()): Promise<{ demoCode: string | null }> {
  const phone = normalizeIndianMobile(phoneInput);
  if (!phone) throw new StoreError(400, "Enter a 10-digit Indian mobile number");
  const [member] = await db
    .select()
    .from(staff)
    .where(and(eq(staff.phone, phone), eq(staff.active, true)));
  if (!member) return { demoCode: null };
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await db.insert(otpChallenges).values({
    id: newId("otp"),
    phone,
    codeHash: hashCode(phone, code),
    expiresAt: new Date(now.getTime() + OTP_TTL_MS),
    createdAt: now,
  });
  return { demoCode: code };
}

/** Check a code. On success the challenge is consumed and the staff member returned. */
export async function verifyOtp(db: Db, phoneInput: string, code: string, now = new Date()): Promise<Actor> {
  const phone = normalizeIndianMobile(phoneInput);
  if (!phone || !/^\d{6}$/.test(code)) throw new StoreError(400, "Enter the 6-digit code");
  const [challenge] = await db
    .select()
    .from(otpChallenges)
    .where(and(eq(otpChallenges.phone, phone), isNull(otpChallenges.consumedAt)))
    .orderBy(desc(otpChallenges.createdAt))
    .limit(1);
  const invalid = new StoreError(401, "Code is wrong or has expired. Ask for a new one.");
  if (!challenge || challenge.expiresAt.getTime() < now.getTime() || challenge.attempts >= OTP_MAX_ATTEMPTS) throw invalid;
  const a = Buffer.from(challenge.codeHash, "hex");
  const b = Buffer.from(hashCode(phone, code), "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    await db
      .update(otpChallenges)
      .set({ attempts: challenge.attempts + 1 })
      .where(eq(otpChallenges.id, challenge.id));
    throw invalid;
  }
  await db.update(otpChallenges).set({ consumedAt: now }).where(eq(otpChallenges.id, challenge.id));
  const actor = await actorForStaff(db, phone, "phone");
  if (!actor) throw invalid;
  return actor;
}

/** Load the current staff record (role comes from the DB, never from the cookie). */
export async function actorForStaff(db: Db, key: string, by: "id" | "phone" = "id"): Promise<Actor | null> {
  const [m] = await db
    .select()
    .from(staff)
    .where(and(by === "id" ? eq(staff.id, key) : eq(staff.phone, key), eq(staff.active, true)));
  if (!m || !isRole(m.role)) return null;
  return { staffId: m.id, orgId: m.orgId, name: m.name, role: m.role, doctorId: m.doctorId };
}
