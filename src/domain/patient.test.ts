import { describe, expect, it } from "vitest";
import { REASON_MAX, nameKey, validateRegistration } from "./patient";

describe("registration", () => {
  it("accepts the minimum fields and normalises them", () => {
    const r = validateRegistration({ name: "  Ramesh   Verma ", phone: "98765 43210", age: "62", reason: "" });
    expect(r).toEqual({ ok: true, value: { name: "Ramesh Verma", phone: "+919876543210", age: 62, reason: null } });
  });

  it("reports each bad field", () => {
    const r = validateRegistration({ name: "R", phone: "123", age: "200", reason: "x".repeat(REASON_MAX + 1) });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(["age", "name", "phone", "reason"]);
  });

  it("rejects digits and symbols in names, and fractional ages", () => {
    expect(validateRegistration({ name: "<script>", phone: "9876543210", age: 30 }).ok).toBe(false);
    expect(validateRegistration({ name: "Asha", phone: "9876543210", age: "3.5" }).ok).toBe(false);
  });

  it("allows Hindi names", () => {
    expect(validateRegistration({ name: "सुनीता देवी", phone: "9876543210", age: 40 }).ok).toBe(true);
  });

  it("matches family members by name case-insensitively", () => {
    expect(nameKey(" Asha  Rao")).toBe(nameKey("asha rao"));
  });
});
