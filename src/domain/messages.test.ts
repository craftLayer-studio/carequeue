import { describe, expect, it } from "vitest";
import { NO_MEDICAL_ADVICE_FOOTER, TEMPLATES, TEMPLATE_PURPOSE, noticeProblems, renderMessage, waMeLink } from "./messages";

describe("messages", () => {
  it("adds the no-medical-advice footer to service messages", () => {
    const m = renderMessage("token_issued", { clinic: "Demo Clinic", patient: "Ramesh Verma", doctor: "Dr. Mehta", token: "A-04", link: "x" });
    expect(m).toContain("Hi Ramesh,");
    expect(m).toContain("A-04");
    expect(m).toContain(NO_MEDICAL_ADVICE_FOOTER);
  });

  it("adds an opt-out link to reminders and marketing", () => {
    const m = renderMessage("followup_reminder", { clinic: "C", patient: "Asha", doctor: "Dr. Rao", when: "Fri, 28 Nov", link: "l", optOutLink: "https://x/o/abc" });
    expect(m).toContain("Stop these messages: https://x/o/abc");
  });

  it("maps every template to a purpose", () => {
    for (const t of TEMPLATES) expect(TEMPLATE_PURPOSE[t]).toBeDefined();
    expect(TEMPLATE_PURPOSE.review_request).toBe("marketing");
  });

  it("blocks offers and medical claims in notices", () => {
    expect(noticeProblems("Free eye check-up camp this Sunday 10 am to 1 pm at the clinic.")).toEqual([]);
    expect(noticeProblems("20% off all consultations this week")).toContain("Clinic notices cannot advertise discounts or offers on medical services");
    expect(noticeProblems("This tablet will cure your diabetes guaranteed").length).toBeGreaterThan(0);
  });

  it("builds wa.me links", () => {
    expect(waMeLink("+919876543210", "hi there")).toBe("https://wa.me/919876543210?text=hi%20there");
  });
});
