import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { can, type Permission } from "@/domain";
import { getDb } from "./db/client";
import { actorForStaff, type Actor } from "./store/auth";
import { StoreError } from "./store/errors";

export const SESSION_COOKIE = "cq_session";
const SESSION_TTL_MS = 12 * 60 * 60_000;
const DEV_SECRET = "carequeue-dev-only-secret-do-not-use-in-production";
let warned = false;

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (s && s.length >= 16) return s;
  if (!warned) console.warn("[carequeue] SESSION_SECRET is not set: using the development fallback secret. Set it before going live.");
  warned = true;
  return DEV_SECRET;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

/** Cookie value `staffId.expiry.signature`. Holds no role: the role is re-read from the DB. */
export function encodeSession(staffId: string, now = Date.now()): string {
  const payload = `${staffId}.${now + SESSION_TTL_MS}`;
  return `${payload}.${sign(payload)}`;
}

export function decodeSession(value: string | undefined, now = Date.now()): string | null {
  if (!value) return null;
  const parts = value.split(".");
  if (parts.length !== 3) return null;
  const [staffId, exp, sig] = parts;
  const expected = Buffer.from(sign(`${staffId}.${exp}`));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  if (!/^\d+$/.test(exp) || Number(exp) < now) return null;
  return staffId;
}

export async function setSession(staffId: string) {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, encodeSession(staffId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && (process.env.APP_URL ?? "").startsWith("https://"),
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export async function clearSession() {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function currentActor(): Promise<Actor | null> {
  const staffId = decodeSession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!staffId) return null;
  return actorForStaff(await getDb(), staffId);
}

/** For route handlers: the signed-in actor or a 401. */
export async function requireActor(): Promise<Actor> {
  const actor = await currentActor();
  if (!actor) throw new StoreError(401, "Please sign in");
  return actor;
}

/** For pages: the signed-in actor with a permission, or redirect to sign-in. */
export async function pageActor(permission: Permission, next: string): Promise<Actor> {
  const actor = await currentActor();
  if (!actor) redirect(`/login?next=${encodeURIComponent(next)}`);
  if (!can(actor.role, permission)) redirect("/staff?denied=1");
  return actor;
}
