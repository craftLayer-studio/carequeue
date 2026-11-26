import { beforeEach, expect, it } from "vitest";
import { rateLimit, resetRateLimits } from "./rate-limit";

beforeEach(() => resetRateLimits());

it("allows up to the limit per window, then rejects with 429", () => {
  for (let i = 0; i < 3; i++) rateLimit("ip:a", 3, 60_000, 1000);
  expect(() => rateLimit("ip:a", 3, 60_000, 1000)).toThrow(/Too many/);
  expect(() => rateLimit("ip:b", 3, 60_000, 1000)).not.toThrow();
  expect(() => rateLimit("ip:a", 3, 60_000, 62_000)).not.toThrow();
});
