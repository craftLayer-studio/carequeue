import { describe, expect, it } from "vitest";
import { formatPhone, maskPhone, normalizeIndianMobile } from "./phone";

describe("phone", () => {
  it("normalises Indian mobile formats to E.164", () => {
    expect(normalizeIndianMobile("98765 43210")).toBe("+919876543210");
    expect(normalizeIndianMobile("+91 98765-43210")).toBe("+919876543210");
    expect(normalizeIndianMobile("09876543210")).toBe("+919876543210");
    expect(normalizeIndianMobile("919876543210")).toBe("+919876543210");
  });

  it("rejects landlines, short numbers and junk", () => {
    expect(normalizeIndianMobile("12345 67890")).toBeNull();
    expect(normalizeIndianMobile("98765")).toBeNull();
    expect(normalizeIndianMobile("98765abc10")).toBeNull();
    expect(normalizeIndianMobile("")).toBeNull();
  });

  it("masks all but the first two and last three digits", () => {
    expect(maskPhone("+919876543210")).toBe("+91 98XXX XX210");
    expect(maskPhone("+919876543210")).not.toContain("76543");
    expect(formatPhone("+919876543210")).toBe("+91 98765 43210");
  });
});
