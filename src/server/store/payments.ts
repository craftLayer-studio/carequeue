/**
 * Fee collection. The amount always comes from the doctor's fee on the server.
 *
 * Payment adapter seam: a gateway adapter (e.g. Razorpay) would create an order and confirm by
 * webhook. The MVP uses the free UPI intent path (`upi://pay?...`): the patient pays in any UPI
 * app and the receptionist confirms receipt. Cash is recorded as paid on the spot.
 */
import { and, eq } from "drizzle-orm";
import { buildUpiUri, formatINR, tokenLabel } from "@/domain";
import { appUrl } from "../config";
import type { Db } from "../db/client";
import { payments, patients, tokens } from "../db/schema";
import type { Actor } from "./auth";
import { audit, getDoctor, getOrg, requirePermission, type Doctor, type Org } from "./clinic";
import { StoreError, notFound } from "./errors";
import { newId } from "./ids";
import { sendTemplate } from "./messaging";

export type Payment = typeof payments.$inferSelect;

export interface PaymentAdapter {
  readonly name: string;
  /** A link the patient opens to pay. */
  paymentLink(org: Org, payment: Payment, doctor: Doctor): string;
}

export const upiIntentAdapter: PaymentAdapter = {
  name: "upi-intent",
  paymentLink(org, payment, doctor) {
    return buildUpiUri({
      vpa: org.upiVpa,
      payeeName: org.upiPayee,
      amount: payment.amountPaise,
      note: `Consultation ${doctor.name}`.slice(0, 50),
      reference: payment.reference,
    });
  },
};

export function upiLinkForPayment(org: Org, payment: Payment, doctor: Doctor): string {
  return upiIntentAdapter.paymentLink(org, payment, doctor);
}

/** Start collecting the consultation fee for a token, by UPI (pending) or cash (paid now). */
export async function collectFee(db: Db, actor: Actor, tokenId: string, method: "upi" | "cash", now = new Date()) {
  requirePermission(actor, "payment:collect");
  return db.transaction(async (tx) => {
    const [t] = await tx
      .select()
      .from(tokens)
      .where(and(eq(tokens.orgId, actor.orgId), eq(tokens.id, tokenId)));
    if (!t) throw notFound("Token");
    if (t.status === "cancelled") throw new StoreError(409, "Token was cancelled");
    const org = await getOrg(tx, actor.orgId);
    const doctor = await getDoctor(tx, actor.orgId, t.doctorId);
    const label = tokenLabel(doctor.tokenPrefix, t.number);
    const [patient] = await tx.select().from(patients).where(eq(patients.id, t.patientId));

    let [payment] = await tx.select().from(payments).where(eq(payments.tokenId, t.id));
    if (payment?.status === "paid") throw new StoreError(409, "Fee already collected for this token");
    if (doctor.feePaise <= 0) throw new StoreError(400, "This doctor has no consultation fee set");

    if (!payment) {
      [payment] = await tx
        .insert(payments)
        .values({
          id: newId("pay"),
          orgId: actor.orgId,
          tokenId: t.id,
          amountPaise: doctor.feePaise,
          method,
          status: method === "cash" ? "paid" : "pending",
          reference: `CQ${t.day.replace(/-/g, "")}${doctor.tokenPrefix}${t.number}`,
          collectedBy: method === "cash" ? actor.staffId : null,
          createdAt: now,
          paidAt: method === "cash" ? now : null,
        })
        .returning();
    } else {
      [payment] = await tx
        .update(payments)
        .set({
          method,
          amountPaise: doctor.feePaise,
          status: method === "cash" ? "paid" : "pending",
          paidAt: method === "cash" ? now : null,
          collectedBy: method === "cash" ? actor.staffId : null,
        })
        .where(eq(payments.id, payment.id))
        .returning();
    }

    const vars = { clinic: org.name, patient: patient.name, token: label, amount: formatINR(payment.amountPaise) };
    if (method === "upi") {
      await sendTemplate(tx, actor.orgId, patient.contactId, "payment_request", { ...vars, link: `${appUrl()}/s/${t.publicToken}` });
    } else {
      await sendTemplate(tx, actor.orgId, patient.contactId, "payment_receipt", vars);
    }
    await audit(tx, actor, actor.orgId, `payment.${method}`, "payment", payment.id, null, now);
    return {
      paymentId: payment.id,
      status: payment.status,
      amount: formatINR(payment.amountPaise),
      upiLink: method === "upi" ? upiLinkForPayment(org, payment, doctor) : null,
    };
  });
}

/** Receptionist confirms a UPI payment arrived (no gateway webhook in the MVP). */
export async function confirmUpi(db: Db, actor: Actor, tokenId: string, now = new Date()) {
  requirePermission(actor, "payment:collect");
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({ payment: payments, token: tokens })
      .from(payments)
      .innerJoin(tokens, eq(tokens.id, payments.tokenId))
      .where(and(eq(payments.orgId, actor.orgId), eq(payments.tokenId, tokenId)));
    if (!row) throw notFound("Payment");
    if (row.payment.status === "paid") throw new StoreError(409, "Already marked paid");
    await tx.update(payments).set({ status: "paid", paidAt: now, collectedBy: actor.staffId }).where(eq(payments.id, row.payment.id));
    const org = await getOrg(tx, actor.orgId);
    const doctor = await getDoctor(tx, actor.orgId, row.token.doctorId);
    const [patient] = await tx.select().from(patients).where(eq(patients.id, row.token.patientId));
    await sendTemplate(tx, actor.orgId, patient.contactId, "payment_receipt", {
      clinic: org.name,
      patient: patient.name,
      token: tokenLabel(doctor.tokenPrefix, row.token.number),
      amount: formatINR(row.payment.amountPaise),
    });
    await audit(tx, actor, actor.orgId, "payment.confirm_upi", "payment", row.payment.id, null, now);
    return { status: "paid" as const };
  });
}
