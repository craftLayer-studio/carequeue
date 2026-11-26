/**
 * Patient registration. Data minimisation: name, mobile, age and an optional short reason.
 * No diagnosis, history, symptoms or other clinical fields are collected by CareQueue.
 */
import { normalizeIndianMobile, type E164 } from "./phone";

export const NAME_MAX = 60;
export const REASON_MAX = 60;
export const AGE_MIN = 0;
export const AGE_MAX = 120;

export interface RegistrationInput {
  name: string;
  phone: string;
  age: number | string;
  reason?: string;
}

export interface Registration {
  name: string;
  phone: E164;
  age: number;
  reason: string | null;
}

export type FieldErrors = Partial<Record<"name" | "phone" | "age" | "reason", string>>;

export type ValidationResult = { ok: true; value: Registration } | { ok: false; errors: FieldErrors };

/** Collapse whitespace and strip control characters. */
export function cleanText(value: string): string {
  // eslint-disable-next-line no-control-regex
  return value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
}

export function validateRegistration(input: RegistrationInput): ValidationResult {
  const errors: FieldErrors = {};

  const name = cleanText(String(input.name ?? ""));
  if (name.length < 2) errors.name = "Enter the patient's name";
  else if (name.length > NAME_MAX) errors.name = `Name must be ${NAME_MAX} characters or fewer`;
  else if (!/^[\p{L}\p{M} .'-]+$/u.test(name)) errors.name = "Use letters, spaces, dots or hyphens only";

  const phone = normalizeIndianMobile(String(input.phone ?? ""));
  if (!phone) errors.phone = "Enter a 10-digit Indian mobile number";

  const ageText = String(input.age ?? "").trim();
  const age = Number(ageText);
  if (ageText === "" || !Number.isInteger(age) || age < AGE_MIN || age > AGE_MAX) {
    errors.age = `Enter age in years (${AGE_MIN}–${AGE_MAX})`;
  }

  const reasonRaw = input.reason === undefined || input.reason === null ? "" : cleanText(String(input.reason));
  if (reasonRaw.length > REASON_MAX) errors.reason = `Keep the reason under ${REASON_MAX} characters`;

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { name, phone: phone!, age, reason: reasonRaw === "" ? null : reasonRaw } };
}

/** Same-person check for family members sharing a phone: case- and space-insensitive name. */
export function nameKey(name: string): string {
  return cleanText(name).toLowerCase();
}
