import { describe, expect, it } from "vitest";
import {
  InvalidTransitionError,
  averageConsultMinutes,
  dueAlerts,
  nextStatus,
  pickNext,
  positionOf,
  tokenLabel,
  waitingOrder,
  type QueueToken,
} from "./queue";

const t0 = new Date("2026-11-25T04:30:00Z");
const at = (min: number) => new Date(t0.getTime() + min * 60_000);

function tok(id: string, number: number, extra: Partial<QueueToken> = {}): QueueToken {
  return { id, number, status: "waiting", priority: "normal", queuedAt: at(number), calledAt: null, doneAt: null, ...extra };
}

describe("token transitions", () => {
  it("follows the queue lifecycle", () => {
    expect(nextStatus("waiting", "call")).toBe("called");
    expect(nextStatus("called", "done")).toBe("done");
    expect(nextStatus("called", "skip")).toBe("skipped");
    expect(nextStatus("skipped", "requeue")).toBe("waiting");
    expect(nextStatus("skipped", "call")).toBe("called");
    expect(nextStatus("waiting", "no_show")).toBe("no_show");
  });

  it("rejects impossible moves", () => {
    expect(() => nextStatus("done", "call")).toThrow(InvalidTransitionError);
    expect(() => nextStatus("waiting", "done")).toThrow(/Cannot done/);
    expect(() => nextStatus("cancelled", "requeue")).toThrow(InvalidTransitionError);
  });
});

describe("ordering", () => {
  it("puts urgent, then elderly, then first come", () => {
    const q = [tok("a", 1), tok("b", 2, { priority: "elderly" }), tok("c", 3, { priority: "urgent" }), tok("d", 4)];
    expect(waitingOrder(q).map((t) => t.id)).toEqual(["c", "b", "a", "d"]);
    expect(pickNext(q)?.id).toBe("c");
  });

  it("ignores tokens that are not waiting", () => {
    const q = [tok("a", 1, { status: "called" }), tok("b", 2, { status: "skipped" }), tok("c", 3)];
    expect(waitingOrder(q).map((t) => t.id)).toEqual(["c"]);
  });

  it("puts requeued tokens at the back by queuedAt", () => {
    const q = [tok("a", 1, { queuedAt: at(30) }), tok("b", 2)];
    expect(waitingOrder(q).map((t) => t.id)).toEqual(["b", "a"]);
  });
});

describe("live wait", () => {
  it("estimates wait from patients ahead and the one with the doctor", () => {
    const q = [tok("a", 1, { status: "called", calledAt: at(10) }), tok("b", 2), tok("c", 3)];
    const p = positionOf(q, "c", at(13), 8);
    expect(p).toEqual({ status: "waiting", ahead: 1, etaMinutes: 8 + 5, nowServing: 1 });
  });

  it("never estimates less than a minute for the current consultation", () => {
    const q = [tok("a", 1, { status: "called", calledAt: at(0) }), tok("b", 2)];
    expect(positionOf(q, "b", at(60), 8).etaMinutes).toBe(1);
  });

  it("returns nulls for tokens no longer waiting", () => {
    const q = [tok("a", 1, { status: "done" })];
    expect(positionOf(q, "a", at(0), 8)).toEqual({ status: "done", ahead: null, etaMinutes: null, nowServing: null });
  });

  it("uses the rolling average after three consultations, clamped", () => {
    const done = (id: string, start: number, mins: number) =>
      tok(id, start, { status: "done", calledAt: at(start), doneAt: at(start + mins) });
    expect(averageConsultMinutes([done("a", 0, 6)], 10)).toBe(10);
    expect(averageConsultMinutes([done("a", 0, 6), done("b", 10, 8), done("c", 20, 10)], 10)).toBe(8);
    expect(averageConsultMinutes([done("a", 0, 200), done("b", 300, 200), done("c", 600, 200)], 10)).toBe(45);
  });
});

describe("turn alerts", () => {
  it("alerts the next patient and those within three", () => {
    const q = [1, 2, 3, 4, 5].map((n) => ({ ...tok(`t${n}`, n), alertedThree: false, alertedNext: false }));
    expect(dueAlerts(q)).toEqual([
      { tokenId: "t1", kind: "next" },
      { tokenId: "t2", kind: "three_ahead" },
      { tokenId: "t3", kind: "three_ahead" },
      { tokenId: "t4", kind: "three_ahead" },
    ]);
  });

  it("sends each alert once", () => {
    const q = [{ ...tok("a", 1), alertedThree: true, alertedNext: true }, { ...tok("b", 2), alertedThree: true, alertedNext: false }];
    expect(dueAlerts(q)).toEqual([]);
  });
});

it("labels tokens with a prefix", () => {
  expect(tokenLabel("A", 7)).toBe("A-07");
  expect(tokenLabel("B", 112)).toBe("B-112");
});
