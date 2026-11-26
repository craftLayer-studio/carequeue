/**
 * Indian mobile numbers. Patients and staff are keyed by phone in E.164 (`+91XXXXXXXXXX`).
 */
export type E164 = string;

/**
 * Normalise user input to E.164. Accepts "98765 43210", "+91 98765-43210", "09876543210",
 * "919876543210". Only Indian mobile numbers (10 digits starting 6-9) are accepted.
 * Returns null when the input is not a valid Indian mobile number.
 */
export function normalizeIndianMobile(input: string): E164 | null {
  if (typeof input !== "string" || input.length > 25) return null;
  if (/[^\d\s+\-()]/.test(input)) return null;
  let digits = input.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  if (!/^[6-9]\d{9}$/.test(digits)) return null;
  return `+91${digits}`;
}

/** Mask a phone for staff without contact rights: "+91 98XXX XX210". */
export function maskPhone(phone: E164): string {
  const local = phone.replace(/^\+91/, "");
  if (local.length !== 10) return "XXXXXXXXXX";
  return `+91 ${local.slice(0, 2)}XXX XX${local.slice(7)}`;
}

/** Pretty print a full number: "+91 98765 43210". */
export function formatPhone(phone: E164): string {
  const local = phone.replace(/^\+91/, "");
  if (local.length !== 10) return phone;
  return `+91 ${local.slice(0, 5)} ${local.slice(5)}`;
}
