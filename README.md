# CareQueue

**Tagline:** Wait from anywhere. Your token comes to your phone.

CareQueue is a QR-first front desk for small clinics, dental practices, physiotherapy centres, diagnostic labs and veterinary clinics in India. A patient scans the QR at reception, registers once, gets a token and watches the live queue on their phone instead of in a crowded waiting room. The clinic gets appointment booking, digital prescriptions written by the doctor, follow-up reminders, lab report delivery on WhatsApp, payments and reviews, with patient consent and data protection built in.

CareQueue does **not** give medical advice, triage, diagnose or suggest treatment. All clinical content comes from the registered practitioner.

## Who it is for (ICP)

- Single-doctor and 2–5 doctor OPD clinics (GP, paediatrics, ENT, dermatology, gynaecology) with 30–120 patients a day.
- Dental clinics and physiotherapy centres with repeat-visit treatment plans.
- Diagnostic labs and sample collection centres delivering reports.
- Veterinary clinics (pet parents, vaccination schedules).
- Tier 1–3 cities, receptionist plus paper token slips or a register today.

Not for: hospitals with IPD (use HMIS), large lab chains with LIMS.

## Top features (MVP)

| Feature | Metric it moves |
|---|---|
| Reception QR token with live queue status and "your turn soon" WhatsApp | Activation |
| Patient self-registration with DPDP consent (and ABHA in P1) | Activation |
| Appointment booking with slot or token-time estimate | Acquisition, revenue |
| Doctor-written digital prescription (template-based, no AI suggestions) sent on WhatsApp | Retention |
| Follow-up reminders set by the doctor | Retention, revenue |
| Lab report delivery via secure WhatsApp link | Activation (labs) |
| UPI payment and Google review request | Revenue, acquisition |

Full list with P0/P1/P2: [docs/01-product-plan.md](docs/01-product-plan.md).

## Pricing (per clinic, INR excluding GST)

| Tier | Monthly | Annual (2 months free) | For |
|---|---|---|---|
| Token | ₹699 (~$8) | ₹6,990 | QR token queue, live wait, WhatsApp turn alerts, 1 counter |
| Clinic | ₹1,499 (~$18) | ₹14,990 | 1–2 doctors: plus booking, registration, e-prescription, follow-ups, payments, reviews |
| Clinic Plus | ₹2,999 (~$35) | ₹29,990 | Up to 5 practitioners or a lab: plus report delivery, ABDM (P1), multi-counter, analytics |

30-day free trial on all tiers. WhatsApp messages billed as prepaid credits. Details: [docs/05-pricing-and-revenue.md](docs/05-pricing-and-revenue.md).

## Why it can win

- Indian clinic software sells the **EMR** first (Practo Ray from ₹999/month, Healthray from ₹499/user/month, Clinicea from $59/practitioner/month). CareQueue sells the **waiting room** first: the problem patients complain about in every review.
- Works alongside any EMR. The clinic does not have to change how the doctor writes notes.
- Government eSushrut@Clinic (₹299 effective per month after subsidy) digitises records but is not a patient-experience or WhatsApp tool; CareQueue can integrate with ABDM instead of competing on records.

## Documents

| Doc | Contents |
|---|---|
| [AGENTS.md](AGENTS.md) | Brief for AI agents, glossary, decisions, open questions |
| [01 Product plan](docs/01-product-plan.md) | Vision, personas, journeys, features by phase, data model, metrics |
| [02 Problems and benefits](docs/02-problems-and-benefits.md) | Problem, solution, benefit per stakeholder |
| [03 Pros, cons, risks](docs/03-pros-cons-risks.md) | Risks, mitigations, kill criteria |
| [04 Market research](docs/04-market-research.md) | Market size, competitors, pricing, trends, regulation, sources |
| [05 Pricing and revenue](docs/05-pricing-and-revenue.md) | Tiers, add-ons, unit economics, 12-month scenarios |
| [06 Go-to-market and onboarding](docs/06-go-to-market-and-onboarding.md) | First 10 customers, sales script, onboarding checklist, retention |

Shared platform modules: [core](https://github.com/craftLayer-studio/craftlayer-core/blob/main/README.md).

## Status

**MVP, demo data, simulated messaging and payments.** The app runs end to end with one fictional clinic ("Sukoon Family Clinic (Demo)", Lucknow). No WhatsApp message is sent: every message goes to an outbox table shown in the app. UPI uses a standard `upi://pay` intent link and reception confirms receipt; no gateway, no money moves in the demo. Product site: https://carequeue.craftlayer.store

## Run it

Requirements: Node.js 20.9+ and pnpm (version pinned in `package.json`).

```bash
pnpm install
cp .env.example .env.local     # optional: APP_URL, SESSION_SECRET, DATABASE_URL
pnpm dev -p 3101               # http://localhost:3101 (empty DB auto-seeds the demo clinic)
```

- Data lives in a local PGlite file DB at `./.data/pglite`. Set `DATABASE_URL` to use Postgres instead. Migrations in `drizzle/` run on start.
- `pnpm db:seed` resets and reseeds the demo clinic and prints the reception QR path.
- Checks: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`, then `pnpm exec astryx doctor --built .`
- `dev` and `build` use webpack (`--webpack`) because native SWC/Turbopack does not load on some machines.

## Demo walkthrough

1. Open `/` and use **Try the demo**. The links carry the demo clinic's random QR token.
2. **Patient** (open on a phone): `/q/<qr>` asks for name, mobile, age, an optional short reason and three separate, unticked consent choices. You get a token and the live page `/s/<token>` with position, estimated wait and who is with the doctor. `/q/<qr>/book` books a slot; `/a/<token>` checks you in on the day. `/m/<token>` lets the patient switch messages off.
3. **Reception**: `/login`, tap "Receptionist: Sunita Yadav" (the one-time code is shown on screen, labelled demo). `/staff` shows each doctor's queue: Call next, Mark done, Skip, Back to queue, No-show, Elderly priority, walk-ins, UPI link or cash. Also `/staff/appointments`, `/staff/patients`, `/staff/followups` (Send due reminders) and `/staff/outbox`.
4. **Doctor**: sign in as "Doctor: Dr. Anjali Mehta (consulting)". Sees only her own queue; opens a patient and sets a follow-up date.
5. **Owner**: sign in as "Owner: Dr. Anjali Mehta". `/owner` shows patients per day, average wait, no-shows, collections, follow-up returns and consent counts, sends review requests and practitioner-approved clinic notices. `/owner/qr` is the printable reception QR sheet, `/owner/settings` edits UPI ID, fees and sessions, `/owner/audit` lists every record view and action.
6. **Assistant** ("Imran Khan") and the owner see masked mobile numbers; receptionist and doctors see full numbers.

## Built vs planned

| Feature (docs/01 #) | State |
|---|---|
| 1 QR token, live queue page, turn alerts at 3 ahead and next | Built (WhatsApp simulated) |
| 2 Staff app: call next, skip, requeue, no-show, elderly/urgent priority | Built |
| 3 Self-registration, DPDP consent ledger, family members on one phone | Built |
| 4 Appointment booking per doctor with check-in | Built (advance fee not yet) |
| 6 Follow-up dates and reminders, appointment reminders | Built (session plans not yet) |
| 8 UPI intent link and cash, daily collection summary | Built (no gateway webhook) |
| 9 Review request to opted-in patients | Built (simulated) |
| 10 Owner dashboard | Built |
| Audit log of record views, masked phones by role, rate-limited public endpoints | Built |
| 5 Practitioner e-Rx, 7 lab report delivery | Planned |
| P1: TV display, ABDM, multi-branch, DPDP export/delete workflow | Planned |

## Health data rules in the product

- Minimum fields only: name, mobile, age, optional reason (60 characters, with a "do not type symptoms" hint).
- No diagnosis, triage or medical-advice features. Every WhatsApp template is operational and service messages carry "We cannot answer medical questions here. In an emergency, call 112."
- Consent: separate unticked choices for visit updates (required for a token), follow-up reminders and clinic news; each stored with purpose, notice version, channel and time. Opt-out link in every reminder.
- Staff see masked phones unless they are a receptionist or doctor. Every patient record view is written to the audit log.

## Code map

See the **Code** section in [AGENTS.md](AGENTS.md).

## Contact

General: hello@craftlayer.store · Product support: carequeue@craftlayer.store · Commercial licences: licensing@craftlayer.store · https://craftlayer.store

## Licence

Source-available under the [PolyForm Noncommercial License 1.0.0](LICENSE.md). Personal, educational, research and non-profit use is free. **Any commercial use requires a paid licence or written permission from CraftLayer Studio.** See [COMMERCIAL-LICENSE.md](COMMERCIAL-LICENSE.md).

Part of the [CraftLayer Products](https://github.com/craftLayer-studio/craftlayer-products) portfolio.
