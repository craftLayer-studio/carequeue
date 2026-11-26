/**
 * Staff roles and what each may do. Enforced on the server for every staff/owner action.
 *
 * - owner: runs the clinic; dashboard, settings, outbox, audit log. Sees masked phones.
 * - receptionist: front desk; queue, check-in, payments, reminders. Sees full phones.
 * - doctor: practitioner; own queue, follow-up dates. Sees full phones.
 * - assistant: helper / nurse; queue only. Sees masked phones.
 */
export const ROLES = ["owner", "receptionist", "doctor", "assistant"] as const;
export type Role = (typeof ROLES)[number];

export type Permission =
  | "queue:operate"
  | "patient:view"
  | "patient:viewFullPhone"
  | "payment:collect"
  | "followup:set"
  | "reminders:send"
  | "appointment:manage"
  | "dashboard:view"
  | "settings:manage"
  | "audit:view"
  | "outbox:view";

const GRANTS: Record<Role, readonly Permission[]> = {
  owner: [
    "queue:operate",
    "patient:view",
    "payment:collect",
    "followup:set",
    "reminders:send",
    "appointment:manage",
    "dashboard:view",
    "settings:manage",
    "audit:view",
    "outbox:view",
  ],
  receptionist: [
    "queue:operate",
    "patient:view",
    "patient:viewFullPhone",
    "payment:collect",
    "reminders:send",
    "appointment:manage",
    "outbox:view",
  ],
  doctor: ["queue:operate", "patient:view", "patient:viewFullPhone", "followup:set", "appointment:manage"],
  assistant: ["queue:operate", "patient:view"],
};

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

export function can(role: Role, permission: Permission): boolean {
  return GRANTS[role].includes(permission);
}

export function permissionsFor(role: Role): readonly Permission[] {
  return GRANTS[role];
}

export const ROLE_LABEL: Record<Role, string> = {
  owner: "Owner",
  receptionist: "Receptionist",
  doctor: "Doctor",
  assistant: "Assistant",
};
