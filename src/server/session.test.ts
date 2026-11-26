import { expect, it } from "vitest";
import { decodeSession, encodeSession } from "./session";

it("round-trips a signed session and rejects tampering or expiry", () => {
  const value = encodeSession("stf_recep", 1000);
  expect(decodeSession(value, 2000)).toBe("stf_recep");
  expect(decodeSession(value.replace("stf_recep", "stf_owner"), 2000)).toBeNull();
  expect(decodeSession(value, 1000 + 13 * 60 * 60_000)).toBeNull();
  expect(decodeSession("garbage", 2000)).toBeNull();
  expect(decodeSession(undefined, 2000)).toBeNull();
});
