import { isConsentPurpose, type ConsentState } from "@/domain";
import { StoreError } from "./store/errors";

/** Run a store call and turn the result or a StoreError into a JSON response. */
export async function handle(fn: () => unknown): Promise<Response> {
  try {
    return Response.json(await fn(), { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    if (err instanceof StoreError || err instanceof BadRequest) {
      return Response.json({ error: err.message }, { status: err.status, headers: { "Cache-Control": "no-store" } });
    }
    console.error(err);
    return Response.json({ error: "Something went wrong" }, { status: 500 });
  }
}

export class BadRequest extends Error {
  readonly status = 400;
}

const MAX_BODY_BYTES = 8_000;

export async function readBody(request: Request): Promise<Record<string, unknown>> {
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) throw new BadRequest("Request too large");
  let value: unknown;
  try {
    value = text ? JSON.parse(text) : {};
  } catch {
    throw new BadRequest("Body must be JSON");
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new BadRequest("Body must be a JSON object");
  return value as Record<string, unknown>;
}

export function str(body: Record<string, unknown>, key: string, max = 200): string {
  const v = body[key];
  if (typeof v !== "string" || v.trim().length === 0 || v.length > max) throw new BadRequest(`${key} is required`);
  return v;
}

export function optStr(body: Record<string, unknown>, key: string, max = 500): string | undefined {
  const v = body[key];
  if (v === undefined || v === null || v === "") return undefined;
  if (typeof v !== "string" || v.length > max) throw new BadRequest(`${key} must be text up to ${max} characters`);
  return v;
}

export function num(body: Record<string, unknown>, key: string): number {
  const v = body[key];
  if (typeof v !== "number" || !Number.isFinite(v)) throw new BadRequest(`${key} must be a number`);
  return v;
}

export function bool(body: Record<string, unknown>, key: string): boolean {
  const v = body[key];
  if (typeof v !== "boolean") throw new BadRequest(`${key} must be true or false`);
  return v;
}

export function oneOf<T extends string>(body: Record<string, unknown>, key: string, allowed: readonly T[]): T {
  const v = body[key];
  if (typeof v !== "string" || !allowed.includes(v as T)) throw new BadRequest(`${key} must be one of ${allowed.join(", ")}`);
  return v as T;
}

/** Consent choices: each must be an explicit boolean (unticked by default on the client). */
export function consent(body: Record<string, unknown>): ConsentState {
  const c = body.consent;
  if (typeof c !== "object" || c === null) throw new BadRequest("consent is required");
  const out: ConsentState = { service: false, reminders: false, marketing: false };
  for (const [k, v] of Object.entries(c)) {
    if (!isConsentPurpose(k) || typeof v !== "boolean") throw new BadRequest("consent must be service, reminders and marketing true/false");
    out[k] = v;
  }
  return out;
}

/** Partial consent update (manage messages page). */
export function consentPatch(body: Record<string, unknown>): Partial<ConsentState> {
  const out: Partial<ConsentState> = {};
  for (const k of ["reminders", "marketing", "service"] as const) {
    if (k in body) out[k] = bool(body, k);
  }
  return out;
}

/** Registration fields (validated in depth by the domain). */
export function registration(body: Record<string, unknown>) {
  const age = body.age;
  if (typeof age !== "number" && typeof age !== "string") throw new BadRequest("age is required");
  return { name: str(body, "name", 80), phone: str(body, "phone", 25), age, reason: optStr(body, "reason", 80) ?? null };
}

export function clientIp(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  return (fwd?.split(",")[0] ?? request.headers.get("x-real-ip") ?? "local").trim().slice(0, 64);
}
