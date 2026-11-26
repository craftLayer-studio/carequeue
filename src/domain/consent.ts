/**
 * Consent under the Digital Personal Data Protection Act 2023 (DPDP). The clinic is the data
 * fiduciary; CareQueue processes on its behalf. Every consent choice is stored as a separate
 * record with purpose, notice version, channel and time. The latest record per purpose wins.
 */
export const CONSENT_PURPOSES = ["service", "reminders", "marketing"] as const;
export type ConsentPurpose = (typeof CONSENT_PURPOSES)[number];

export const CONSENT_CHANNELS = ["qr", "booking", "staff", "optout_link"] as const;
export type ConsentChannel = (typeof CONSENT_CHANNELS)[number];

/** Bump when the notice text changes; stored with every consent record. */
export const NOTICE_VERSION = "cq-health-2026-11-v1";

/** Short privacy notice shown above the form. Specific to health data. */
export const PRIVACY_NOTICE: readonly string[] = [
  "The clinic collects only your name, mobile number, age and, if you choose, a short reason for the visit. This is health-related personal data.",
  "It is used to give you a queue token, call you in, book appointments and collect fees. It is not sold, not used for advertising and not shared with anyone outside the clinic, except our software provider who processes it for the clinic.",
  "Do not type symptoms or medical history here. Your doctor will ask in person. CareQueue does not give medical advice. In an emergency, call 112.",
  "Clinic staff see your full number only if they are the receptionist or a doctor. Every time staff open your record it is logged.",
  "You can withdraw consent or ask for your details to be corrected or deleted at the front desk or from the link in any message.",
];

export interface ConsentOption {
  purpose: ConsentPurpose;
  label: string;
  description: string;
  required: boolean;
}

/** The three separate, unticked choices. Only `service` is needed to join the queue. */
export const CONSENT_OPTIONS: readonly ConsentOption[] = [
  {
    purpose: "service",
    label: "Use my details for this visit (required)",
    description:
      "I agree that the clinic may process my name, mobile number, age and visit reason to issue my token, send queue and appointment updates on WhatsApp, and record payment for this visit.",
    required: true,
  },
  {
    purpose: "reminders",
    label: "Follow-up reminders (optional)",
    description: "Send me reminders for follow-up visits and appointments that my doctor sets. No health advice is sent.",
    required: false,
  },
  {
    purpose: "marketing",
    label: "Clinic news and review requests (optional)",
    description: "Send me doctor-approved health camp notices and an occasional request to review the clinic.",
    required: false,
  },
];

export interface ConsentRecordLike {
  purpose: ConsentPurpose;
  granted: boolean;
  at: Date;
}

export type ConsentState = Record<ConsentPurpose, boolean>;

/** Current consent per purpose: the latest record wins; no record means not granted. */
export function currentConsent(records: readonly ConsentRecordLike[]): ConsentState {
  const state: ConsentState = { service: false, reminders: false, marketing: false };
  const latest = new Map<ConsentPurpose, ConsentRecordLike>();
  for (const r of records) {
    const prev = latest.get(r.purpose);
    if (!prev || r.at.getTime() >= prev.at.getTime()) latest.set(r.purpose, r);
  }
  for (const [purpose, r] of latest) state[purpose] = r.granted;
  return state;
}

/** Which purposes changed between the current state and the desired choices. */
export function consentChanges(current: ConsentState, desired: Partial<ConsentState>): { purpose: ConsentPurpose; granted: boolean }[] {
  const out: { purpose: ConsentPurpose; granted: boolean }[] = [];
  for (const purpose of CONSENT_PURPOSES) {
    const want = desired[purpose];
    if (want !== undefined && want !== current[purpose]) out.push({ purpose, granted: want });
  }
  return out;
}

export function isConsentPurpose(value: unknown): value is ConsentPurpose {
  return typeof value === "string" && (CONSENT_PURPOSES as readonly string[]).includes(value);
}
