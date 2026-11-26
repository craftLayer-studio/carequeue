import { and, asc, eq } from "drizzle-orm";
import { can, type Permission } from "@/domain";
import type { Tx } from "../db/client";
import { auditLog, doctors, orgs } from "../db/schema";
import type { Actor } from "./auth";
import { forbidden, notFound } from "./errors";
import { newId } from "./ids";

export type Org = typeof orgs.$inferSelect;
export type Doctor = typeof doctors.$inferSelect;

export function requirePermission(actor: Actor, permission: Permission): void {
  if (!can(actor.role, permission)) throw forbidden();
}

export async function getOrg(tx: Tx, orgId: string): Promise<Org> {
  const [org] = await tx.select().from(orgs).where(eq(orgs.id, orgId));
  if (!org) throw notFound("Clinic");
  return org;
}

export async function getOrgByQr(tx: Tx, qrToken: string): Promise<Org> {
  const [org] = await tx.select().from(orgs).where(eq(orgs.qrToken, qrToken));
  if (!org) throw notFound("Clinic");
  return org;
}

export async function listDoctors(tx: Tx, orgId: string, activeOnly = true): Promise<Doctor[]> {
  const rows = await tx.select().from(doctors).where(eq(doctors.orgId, orgId)).orderBy(asc(doctors.tokenPrefix));
  return activeOnly ? rows.filter((d) => d.active) : rows;
}

export async function getDoctor(tx: Tx, orgId: string, doctorId: string): Promise<Doctor> {
  const [d] = await tx
    .select()
    .from(doctors)
    .where(and(eq(doctors.orgId, orgId), eq(doctors.id, doctorId)));
  if (!d) throw notFound("Doctor");
  return d;
}

/** Public, non-sensitive view of a doctor for patient pages. */
export function publicDoctor(d: Doctor) {
  return {
    id: d.id,
    name: d.name,
    qualification: d.qualification,
    speciality: d.speciality,
    feePaise: d.feePaise,
    tokenPrefix: d.tokenPrefix,
  };
}

/** Public view of the clinic for patient pages. */
export function publicOrg(o: Org) {
  return { name: o.name, kind: o.kind, city: o.city, address: o.address, phone: o.phone, isDemo: o.isDemo };
}

export async function audit(
  tx: Tx,
  actor: Actor | null,
  orgId: string,
  action: string,
  entity: string,
  entityId: string,
  ip: string | null = null,
  at = new Date(),
): Promise<void> {
  await tx.insert(auditLog).values({ id: newId("aud"), orgId, staffId: actor?.staffId ?? null, action, entity, entityId, ip, at });
}
