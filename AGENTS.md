# CareQueue — brief for AI agents

## Context

CareQueue is the small-clinic product in the CraftLayer portfolio. It runs on the shared CraftLayer core (QR engine, booking engine, CRM, WhatsApp messaging, payments, reviews, staff app, analytics). This folder documents only what is specific to clinics, dental, physio, diagnostic labs and veterinary practices.

Commercial thesis: in Indian outpatient settings, waiting time is many times longer than consultation time (studies report 59–98 minute waits against 6–7 minute consultations; see [04](docs/04-market-research.md)). Small clinics run on paper token slips and a shouting receptionist. A QR token with a live queue on the patient's phone is a visible, cheap fix that a doctor can buy in one conversation. Once the clinic has the patient's number with consent, follow-ups, prescriptions on WhatsApp and report delivery add retention and revenue.

Health data is high-stakes. Product, copy and agents must treat it carefully.

## Reading order

1. [README.md](README.md)
2. [docs/01-product-plan.md](docs/01-product-plan.md) — including the "clinical safety boundaries" section.
3. [docs/04-market-research.md](docs/04-market-research.md) — regulation section before writing any feature.
4. [docs/05-pricing-and-revenue.md](docs/05-pricing-and-revenue.md)
5. [docs/06-go-to-market-and-onboarding.md](docs/06-go-to-market-and-onboarding.md)
6. [docs/02-problems-and-benefits.md](docs/02-problems-and-benefits.md), [docs/03-pros-cons-risks.md](docs/03-pros-cons-risks.md)

## Glossary

| Term | Meaning |
|---|---|
| Clinic | One physical practice location. Pricing is per clinic. |
| Practitioner | Registered doctor, dentist, physiotherapist or veterinarian who consults. |
| Counter | A queue served by one practitioner or one service point (e.g. sample collection). |
| Token | Queue number given at check-in. Can be walk-in or appointment. |
| Live wait | Estimated minutes until a token is called, shown on the patient's phone. Based on rolling average consultation time. |
| e-Rx | Digital prescription authored and approved by the practitioner. |
| Follow-up | Revisit date set by the practitioner; triggers a reminder. |
| Report delivery | Lab or imaging report sent as an OTP-protected link on WhatsApp. |
| ABDM | Ayushman Bharat Digital Mission, India's national digital health network. |
| ABHA | Ayushman Bharat Health Account: the patient's 14-digit health ID / address. |
| HFR / HPR | Health Facility Registry / Healthcare Professionals Registry under ABDM. |
| Scan and Share | ABDM feature where a patient scans a facility QR to share ABHA profile and get a token. |
| M1 / M2 / M3 | ABDM integration milestones: ABHA creation/verification; linking records as health information provider; fetching records as health information user. |
| DHIS | Digital Health Incentive Scheme: ABDM pays facilities per ABHA-linked digital record above a base level; software vendors get a share. |
| Data fiduciary / processor | Under DPDP Act: the clinic decides purpose (fiduciary); CareQueue processes on its behalf (processor). |

## Decisions made

1. **No medical advice features.** No symptom checker, triage, AI diagnosis, drug suggestions or dosage calculators. Prescriptions are typed or picked from the practitioner's own saved templates and must be approved by the practitioner before sending.
2. **Queue first, EMR light.** We do not try to replace full EMRs. MVP has registration, visit record, e-Rx and follow-up date. Clinical notes are free text owned by the practitioner.
3. **Per-clinic flat pricing**, 30-day free trial, no permanent free tier (storage of health data carries cost and liability).
4. **Report and prescription sharing uses OTP-protected links**, not PDF attachments, so data is not left in chat backups without control, and links can expire.
5. **Consent at registration** with separate checkboxes: (a) service messages for this visit (token, report, prescription), (b) follow-up reminders, (c) offers and health camp news. Only (a) is required to use the queue.
6. **India data residency.** Store all patient data in Indian cloud regions; encrypt at rest and in transit; access logs kept at least one year.
7. **Marketing restraint.** Doctors in India are bound by professional conduct rules on advertising. CareQueue sends no promotional campaigns by default; only practitioner-approved reminders and health-camp notices.
8. **Vets** use the same product with pet profiles; ABDM does not apply.

## Open questions

1. **Name check.** No major established brand named "CareQueue" was found; only two 2025 hackathon projects on Devfolio and a similar-sounding cloud queue tool "QueueCare" (see [04](docs/04-market-research.md)). Folder slug and name stay `carequeue`. Run a formal trademark search (Class 9, 42, 44) before launch. Backup names if a conflict appears: **TokenCare**, **ClinicQ**.
2. ABDM integration timing: build M1 (ABHA verify via Scan and Share) in P1 or wait for 50 paying clinics? DHIS incentive and doctor interest argue for P1.
3. Should CareQueue be ABDM-certified as an HMIS/clinic software to earn the 25% DSC share of DHIS incentives, or stay as a front-desk tool that integrates with certified EMRs?
4. Teleconsultation (P2): build to Telemedicine Practice Guidelines 2020, or partner?
5. Does the government eSushrut@Clinic (₹299 effective/month) cap what small clinics will pay? Test price sensitivity in pilot.
6. Children's data: confirm with counsel the scope of DPDP Rules 2025 exemption from verifiable parental consent for clinical establishments and healthcare professionals (paediatric clinics, vet not affected).
7. Medical records retention period for small clinics (commonly cited 3 years under Indian Medical Council professional conduct regulations 2002; verify) versus DPDP erasure on request: define the rule with counsel.
8. Payments for consultation: GST-exempt healthcare services versus our GST-bearing subscription: confirm invoice handling with CA.

## Rules for agents editing this folder

- Follow [CONVENTIONS.md](https://github.com/craftLayer-studio/craftlayer-products/blob/main/CONVENTIONS.md).
- Never add a feature that gives a patient or staff member clinical advice. If unsure, it is out of scope.
- Every new number needs a source link with access date, or **(estimate)** with reasoning.
- Tie every feature to one metric: acquisition, activation, retention, revenue or referral.
- Any new data field about patients needs a stated purpose and retention rule.

## Code

MVP web app: Next.js 16 (App Router, webpack), React 19, TypeScript strict, Astryx design system (custom `carequeue` theme derived from Matcha), Drizzle ORM on Postgres (PGlite in dev and tests), Vitest.

### Structure

```
src/domain/         Pure rules, no React/Next/IO. Unit tested (*.test.ts next to each file).
  queue.ts          Token states and transitions, call order, live wait, turn alerts
  consent.ts        DPDP purposes, notice text, notice version, latest-record-wins
  patient.ts        Minimal registration fields and validation
  phone.ts          E.164 normalisation and masking
  roles.ts          Roles and permissions (who sees full phones)
  slots.ts          Doctor sessions and appointment slots (IST)
  followup.ts       Follow-up date rules and reminder timing
  messages.ts       WhatsApp templates (no medical advice), notice guard
  metrics.ts        Dashboard: patients per day, average wait, no-shows, collections
  money.ts, upi.ts, time.ts
src/server/db/      schema.ts (Drizzle), client.ts (PGlite or pg), seed.ts (demo clinic), CLIs
src/server/store/   Use cases in transactions; every query filters by org_id
  messaging.ts      Messaging adapter seam; simulated WhatsApp writes to `outbox`
  payments.ts       Payment adapter seam; UPI intent link + cash
src/server/         http.ts (input parsing), session.ts (signed cookie), rate-limit.ts, page.ts (page guard)
src/app/api/        Thin route handlers: parse, validate, call store, JSON
src/app/            Pages: / landing, /q/[qr] QR registration, /q/[qr]/book, /s/[pt] live token,
                    /a/[pt] appointment, /m/[token] manage messages, /login, /staff/*, /owner/*
src/components/     Astryx UI (patient/, staff/, owner/)
drizzle/            Generated SQL migrations (commit them)
themes/carequeue/   Theme source (editor); src/themes/carequeue/ is the app copy
```

### Commands

```bash
pnpm install
pnpm dev -p 3101       # dev server; empty DB auto-seeds the demo clinic
pnpm db:seed           # reset and reseed the demo clinic
pnpm db:generate       # new migration after editing schema.ts
pnpm typecheck && pnpm lint && pnpm test && pnpm build
pnpm exec astryx doctor --built .
```

### Rules

- Health data: collect only name, mobile, age and an optional short reason. Any new patient field needs a purpose and retention note in `schema.ts`. No clinical advice, triage or diagnosis features.
- Every send goes through `sendTemplate`, which checks the purpose-specific consent. Never write to `outbox` directly.
- Every staff/owner action checks a permission from `domain/roles.ts` on the server. Phones shown to staff go through `phoneFor` (masked unless receptionist or doctor). Patient record views call `audit`.
- Every business row has `org_id`; every query filters by it. Public links use random tokens, never row ids.
- Money is integer paise; amounts come from the doctor's fee on the server, never from the request.
- Times are UTC `timestamptz`; clinic days and display are IST (`domain/time.ts`).
- Integrations stay behind adapters with simulated defaults. No real API keys or paid services.
- `dev` and `build` keep `--webpack`.
- Commits: conventional subjects. Never add a Co-Authored-By trailer or a "Generated with" line.

<!-- ASTRYX:START -->
Astryx v0.7.17 · 174 components
CLI: run every command as `pnpm exec astryx <cmd>` (shown below as `astryx ...`).

SETUP (once, in app entry e.g. main.tsx) — without these, components render unstyled:
  import "@astryxdesign/core/reset.css";
  import "@astryxdesign/core/astryx.css";

WORKFLOW — start every page from a template, never from scratch:
1. `astryx build "<idea>"` — names the template to scaffold from and the parts it lacks.
2. `astryx template <name> <path>` — scaffold it; keep its frame, gap and padding; replace the content.
3. `astryx component <Name>` to read props before using one; `astryx template <Block>` prints a block example to read for a part it lacks. Astryx names differ from other libraries: buttons, badges, tokens and tabs take their text in `label` (Text, Heading and Link take children), booleans start with `is` or `has` (`isOpen`, `isDisabled`), and every input takes `value` and `onChange`.
Changing an existing page? Keep it: skip step 2 and add components inside its sections; read a block example when it helps.
Before you deliver a build, run `astryx doctor --built <dir>`; don't deliver it if it fails.

RULES:
- No <div> — components handle all layout and spacing.
- Read `astryx docs layout` before changing a template's frame.
- Dense data = rows (Table, List/Item), not Card-wrapped lists. Badge = counts only.
- Style with component props first, then tokens (var(--color-*|--spacing-*|--radius-*)). No raw hex/px. No StyleX/Tailwind compiler here — don't use xstyle/utility classes directly. Some templates use StyleX and need a compiler plugin; see `astryx docs styling-overview`.
- THEMES: palettes and custom colors go through the theme, never :root overrides; so does a denser or roomier app (`editor set <name> spacing tight`), never gap and padding changes page by page. A change to one kind of part (the sidebar, its selected item, the gaps in a form) is a theme change too, not props on one page: `editor how "<ask>"` names the `set … --on <part>` line. No app yet: `astryx experimental theme preview app <dir>` makes a starter app that shows the theme. To make or change a theme (colors, fonts, corners, spacing, a look from a picture), prefer the experimental theme editor over hand-written theme files: `astryx experimental theme editor new <name> --like neutral`, then `editor set <name> <thing> <value>` or `editor how "<what you want>"`; wire it with `astryx theme add <name>`; after each change look at it with `astryx experimental theme editor show <name> --png` (takes pictures of real components) and open the PNGs it writes; a theme change is not done until you have looked at the pictures. In code, extend an imported theme to customize it; `theme eject <slug>` only forks source. See `astryx docs theme`.
- SELF-CHECK: re-read the file; replace any raw <div>/<span>, imported .css/@apply, or hardcoded #hex/px with the component or a token.

`astryx help` lists every command. Key ones beyond the workflow:
  search "<query>"   find any component / hook / doc / template
  discover <words>   integrations you could add
  docs <topic>       getting-started, principles, tokens, theme … (`astryx docs` lists all)
  docs cli           commands and API reference
  docs authoring     build an integration package, and every field it holds
  upgrade --from <old version> --apply   run after a dependency bump
To remove this block, run `astryx init --remove-agents`, which removes it from the agent files at the project root and in the folder you run it in; from any other file it leaves, delete everything from ASTRYX:START to ASTRYX:END.
<!-- ASTRYX:END -->
