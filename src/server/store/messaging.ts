/**
 * Messaging adapter seam. Real WhatsApp (via a BSP) or SMS adapters would implement
 * `MessagingAdapter`; the MVP ships only the simulated adapter, which writes to the `outbox`
 * table and makes no network call.
 */
import { and, eq } from "drizzle-orm";
import { currentConsent, renderMessage, TEMPLATE_PURPOSE, waMeLink, type ConsentPurpose, type MessageVars, type Template } from "@/domain";
import { appUrl } from "../config";
import type { Tx } from "../db/client";
import { consentRecords, contacts, outbox } from "../db/schema";
import { newId } from "./ids";

export interface OutgoingMessage {
  orgId: string;
  contactId: string;
  toPhone: string;
  template: Template;
  purpose: ConsentPurpose;
  body: string;
}

export interface MessagingAdapter {
  readonly name: string;
  send(tx: Tx, message: OutgoingMessage, status: "sent" | "skipped_no_consent"): Promise<{ id: string }>;
}

export const simulatedWhatsApp: MessagingAdapter = {
  name: "simulated-whatsapp",
  async send(tx, m, status) {
    const id = newId("msg");
    await tx.insert(outbox).values({
      id,
      orgId: m.orgId,
      contactId: m.contactId,
      channel: "whatsapp",
      toPhone: m.toPhone,
      template: m.template,
      purpose: m.purpose,
      body: m.body,
      status,
      adapter: "simulated-whatsapp",
    });
    return { id };
  },
};

let adapter: MessagingAdapter = simulatedWhatsApp;
export function setMessagingAdapter(a: MessagingAdapter) {
  adapter = a;
}

export async function consentFor(tx: Tx, orgId: string, contactId: string) {
  const rows = await tx
    .select({ purpose: consentRecords.purpose, granted: consentRecords.granted, at: consentRecords.at })
    .from(consentRecords)
    .where(and(eq(consentRecords.orgId, orgId), eq(consentRecords.contactId, contactId)));
  return currentConsent(rows as { purpose: ConsentPurpose; granted: boolean; at: Date }[]);
}

/**
 * Render and send a template to a contact, only if they consented to the template's purpose.
 * Messages without consent are recorded as `skipped_no_consent` so staff can see why.
 */
export async function sendTemplate(
  tx: Tx,
  orgId: string,
  contactId: string,
  template: Template,
  vars: Omit<MessageVars, "optOutLink">,
): Promise<{ sent: boolean }> {
  const [contact] = await tx
    .select()
    .from(contacts)
    .where(and(eq(contacts.orgId, orgId), eq(contacts.id, contactId)));
  if (!contact) return { sent: false };
  const purpose = TEMPLATE_PURPOSE[template];
  const consent = await consentFor(tx, orgId, contactId);
  const body = renderMessage(template, { ...vars, optOutLink: `${appUrl()}/m/${contact.prefsToken}` });
  const ok = consent[purpose];
  await adapter.send(tx, { orgId, contactId, toPhone: contact.phone, template, purpose, body }, ok ? "sent" : "skipped_no_consent");
  return { sent: ok };
}

export { waMeLink };
