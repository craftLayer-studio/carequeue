/**
 * WhatsApp message templates. Operational text only: no health advice, no diagnosis, no drug or
 * dosage content. Each template is tied to the consent purpose it needs.
 */
import type { ConsentPurpose } from "./consent";

export const TEMPLATES = [
  "token_issued",
  "turn_three_ahead",
  "turn_next",
  "appointment_booked",
  "appointment_reminder",
  "followup_reminder",
  "payment_request",
  "payment_receipt",
  "review_request",
  "clinic_notice",
] as const;
export type Template = (typeof TEMPLATES)[number];

export const TEMPLATE_PURPOSE: Record<Template, ConsentPurpose> = {
  token_issued: "service",
  turn_three_ahead: "service",
  turn_next: "service",
  appointment_booked: "service",
  payment_request: "service",
  payment_receipt: "service",
  appointment_reminder: "reminders",
  followup_reminder: "reminders",
  review_request: "marketing",
  clinic_notice: "marketing",
};

export const NO_MEDICAL_ADVICE_FOOTER =
  "We cannot answer medical questions on WhatsApp. Please call the clinic. In an emergency, call 112.";

export interface MessageVars {
  clinic: string;
  patient: string;
  doctor?: string;
  token?: string;
  link?: string;
  when?: string;
  amount?: string;
  text?: string;
  optOutLink?: string;
}

/** Render a template. Unknown vars render empty; text stays short for WhatsApp. */
export function renderMessage(template: Template, v: MessageVars): string {
  const first = v.patient.split(" ")[0] ?? v.patient;
  let body: string;
  switch (template) {
    case "token_issued":
      body = `Hi ${first}, your token at ${v.clinic} is ${v.token} for ${v.doctor}. Track your turn live: ${v.link}`;
      break;
    case "turn_three_ahead":
      body = `${v.clinic}: token ${v.token}, 3 patients are ahead of you. Please start heading back to the waiting area. ${v.link}`;
      break;
    case "turn_next":
      body = `${v.clinic}: token ${v.token}, you are next for ${v.doctor}. Please be at the reception.`;
      break;
    case "appointment_booked":
      body = `Hi ${first}, your appointment with ${v.doctor} at ${v.clinic} is booked for ${v.when}. Check in on arrival: ${v.link}`;
      break;
    case "appointment_reminder":
      body = `Reminder: ${first}, you have an appointment with ${v.doctor} at ${v.clinic} on ${v.when}. ${v.link}`;
      break;
    case "followup_reminder":
      body = `Hi ${first}, ${v.doctor} at ${v.clinic} asked us to remind you of your follow-up visit due ${v.when}. Book a time: ${v.link}`;
      break;
    case "payment_request":
      body = `${v.clinic}: consultation fee ${v.amount} for token ${v.token}. Pay by UPI: ${v.link}`;
      break;
    case "payment_receipt":
      body = `${v.clinic}: received ${v.amount} for token ${v.token}. Thank you.`;
      break;
    case "review_request":
      body = `Hi ${first}, thank you for visiting ${v.clinic}. If you have a minute, please tell others about your experience: ${v.link}`;
      break;
    case "clinic_notice":
      body = `${v.clinic}: ${v.text}`;
      break;
  }
  const footer = TEMPLATE_PURPOSE[template] === "service" ? NO_MEDICAL_ADVICE_FOOTER : `Stop these messages: ${v.optOutLink ?? ""}`;
  return `${body}\n\n${footer}`.trim();
}

/** wa.me click-to-chat link (free interim path a receptionist can tap to send by hand). */
export function waMeLink(phoneE164: string, text: string): string {
  return `https://wa.me/${phoneE164.replace(/^\+/, "")}?text=${encodeURIComponent(text)}`;
}

export const NOTICE_MAX = 300;

/**
 * Clinic notices (health camps, holiday hours) must be approved by a practitioner and must not
 * contain discount/offer language on medical services (professional conduct rules). This is a
 * coarse server-side guard, not a substitute for the practitioner's approval.
 */
export function noticeProblems(text: string): string[] {
  const problems: string[] = [];
  const t = text.trim();
  if (t.length < 10) problems.push("Notice is too short");
  if (t.length > NOTICE_MAX) problems.push(`Keep the notice under ${NOTICE_MAX} characters`);
  if (/\b(\d+\s?%\s?off|discount|cashback|free consultation|offer)\b/i.test(t)) {
    problems.push("Clinic notices cannot advertise discounts or offers on medical services");
  }
  if (/\b(cure|guarantee|diagnos|prescri|dose|dosage|tablet|medicine for)\b/i.test(t)) {
    problems.push("Clinic notices cannot contain medical claims or treatment advice");
  }
  return problems;
}
