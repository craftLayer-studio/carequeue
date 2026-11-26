import { describe, expect, it } from "vitest";
import { can, isRole } from "./roles";

describe("roles", () => {
  it("shows full phone numbers only to receptionists and doctors", () => {
    expect(can("receptionist", "patient:viewFullPhone")).toBe(true);
    expect(can("doctor", "patient:viewFullPhone")).toBe(true);
    expect(can("owner", "patient:viewFullPhone")).toBe(false);
    expect(can("assistant", "patient:viewFullPhone")).toBe(false);
  });

  it("keeps settings and audit with the owner", () => {
    expect(can("owner", "settings:manage")).toBe(true);
    expect(can("receptionist", "settings:manage")).toBe(false);
    expect(can("doctor", "audit:view")).toBe(false);
    expect(can("assistant", "payment:collect")).toBe(false);
  });

  it("lets only practitioners and the owner set follow-ups", () => {
    expect(can("doctor", "followup:set")).toBe(true);
    expect(can("receptionist", "followup:set")).toBe(false);
  });

  it("recognises roles", () => {
    expect(isRole("doctor")).toBe(true);
    expect(isRole("admin")).toBe(false);
  });
});
