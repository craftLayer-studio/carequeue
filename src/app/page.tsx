import { Badge } from "@astryxdesign/core/Badge";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { Divider } from "@astryxdesign/core/Divider";
import { Grid } from "@astryxdesign/core/Grid";
import { HStack, Layout, LayoutContent, VStack } from "@astryxdesign/core/Layout";
import { Link } from "@astryxdesign/core/Link";
import { List, ListItem } from "@astryxdesign/core/List";
import { Section } from "@astryxdesign/core/Section";
import { Heading, Text } from "@astryxdesign/core/Text";
import { COMPANY_URL, GENERAL_EMAIL, LICENSING_EMAIL, SUPPORT_EMAIL } from "@/server/config";
import { getDb } from "@/server/db/client";
import { demoQrToken } from "@/server/db/seed";

export const dynamic = "force-dynamic";

const STEPS = [
  { title: "Scan at reception", body: "The patient scans the QR on the desk, types name, mobile and age, and ticks consent. No app, no login." },
  { title: "Wait from anywhere", body: "A token and live wait show on their phone. WhatsApp pings at 3 patients ahead and when they are next." },
  { title: "Call next", body: "Reception or the doctor taps Call next. Skip, no-show and elderly priority are one tap each." },
  { title: "Collect and follow up", body: "Fee by UPI link or cash. The doctor sets a follow-up date and CareQueue reminds the patient." },
];

const FEATURES = [
  { title: "QR self-registration", body: "Only name, mobile, age and an optional short reason. Family members share one number." },
  { title: "Live token page", body: "Position, estimated wait from today's real consultation times, and who is with the doctor now." },
  { title: "Staff queue screen", body: "Per-doctor queues with call next, skip, requeue, no-show and walk-ins for patients without a smartphone." },
  { title: "Appointment booking", body: "Slots per doctor and session. Patients check in on arrival and join the queue." },
  { title: "Follow-up reminders", body: "Doctor-set dates. Reminders go only to patients who opted in, with a one-tap opt-out link." },
  { title: "UPI and cash", body: "UPI intent link opens any UPI app; reception confirms. Cash recorded at the desk." },
  { title: "Owner dashboard", body: "Patients per day, average wait, no-shows, collections, follow-up returns and consent counts." },
  { title: "Built for health data", body: "Separate consent choices, masked phones by role, and an audit log of every record view." },
];

export default async function Home() {
  const qr = await demoQrToken(await getDb());
  return (
    <Layout
      height="auto"
      content={
        <LayoutContent role="main" padding={6} isScrollable={false}>
          <VStack gap={10} hAlign="center">
            <VStack gap={6} hAlign="center" maxWidth={760}>
              <HStack gap={2} vAlign="center">
                <Text type="large" weight="bold">
                  CareQueue
                </Text>
                <Badge variant="info" label="MVP" />
              </HStack>
              <VStack gap={3} hAlign="center">
                <Heading level={1} justify="center" textWrap="balance">
                  Wait from anywhere. Your token comes to your phone.
                </Heading>
                <Text type="large" color="secondary" justify="center" textWrap="balance">
                  A calm, QR-first front desk for small clinics, dental and physio practices, labs and vets in India. Patients see their place in the queue on their phone instead of in a crowded waiting room.
                </Text>
              </VStack>
              <HStack gap={3} wrap="wrap" hAlign="center">
                <Button label="Try the demo" variant="primary" size="lg" href="#demo" />
                <Button label="Staff sign in" size="lg" href="/login" />
              </HStack>
            </VStack>

            <Section variant="muted" padding={6} width="100%" maxWidth={1100}>
              <VStack gap={4}>
                <Heading level={2}>How it works</Heading>
                <Grid columns={{ minWidth: 220 }} gap={4}>
                  {STEPS.map((s, i) => (
                    <Card key={s.title} padding={4}>
                      <VStack gap={2}>
                        <Text type="supporting" color="secondary">{`Step ${i + 1}`}</Text>
                        <Heading level={3}>{s.title}</Heading>
                        <Text color="secondary">{s.body}</Text>
                      </VStack>
                    </Card>
                  ))}
                </Grid>
              </VStack>
            </Section>

            <VStack gap={4} width="100%" maxWidth={1100}>
              <Heading level={2}>What is in the MVP</Heading>
              <Grid columns={{ minWidth: 240 }} gap={4}>
                {FEATURES.map((f) => (
                  <Card key={f.title} padding={4} variant="muted">
                    <VStack gap={1}>
                      <Text weight="semibold">{f.title}</Text>
                      <Text type="supporting" color="secondary">
                        {f.body}
                      </Text>
                    </VStack>
                  </Card>
                ))}
              </Grid>
            </VStack>

            <Card padding={6} width="100%" maxWidth={1100}>
              <VStack gap={4}>
                <HStack gap={2} vAlign="center">
                  <Heading level={2} id="demo">
                    Try the demo
                  </Heading>
                  <Badge variant="warning" label="Demo" />
                </HStack>
                <Text color="secondary">
                  &quot;Sukoon Family Clinic&quot; in Lucknow is fictional, with made-up patients. WhatsApp and payments are simulated: nothing is sent or charged. Open the patient page on your phone and the queue screen on a laptop to watch them update together.
                </Text>
                <List hasDividers>
                  {qr ? (
                    <>
                      <ListItem label="1. Scan the reception QR as a patient" description="Register, tick consent and get a token with live wait." href={`/q/${qr}`} />
                      <ListItem label="2. Book an appointment" description="Pick a doctor, day and slot." href={`/q/${qr}/book`} />
                    </>
                  ) : null}
                  <ListItem
                    label="3. Run the queue as the receptionist"
                    description="Sign in as Sunita Yadav (demo code is shown on screen). Call next, skip, collect fees."
                    href="/login?next=/staff"
                  />
                  <ListItem label="4. See the owner dashboard" description="Sign in as Dr. Anjali Mehta, Owner. Patients per day, average wait, no-shows, follow-ups, QR sheet." href="/login?next=/owner" />
                </List>
              </VStack>
            </Card>

            <VStack gap={3} width="100%" maxWidth={1100}>
              <Heading level={2}>Health data, handled carefully</Heading>
              <Grid columns={{ minWidth: 240 }} gap={4}>
                <Text color="secondary">
                  No symptom checker, triage score or medical advice anywhere in the product. Clinical decisions stay with the registered practitioner.
                </Text>
                <Text color="secondary">
                  Separate, unticked consent for visit updates, follow-up reminders and clinic news, stored with notice version and time under the DPDP Act 2023.
                </Text>
                <Text color="secondary">
                  Assistants and owners see masked mobile numbers. Every patient record view is written to an audit log.
                </Text>
              </Grid>
            </VStack>

            <Divider />
            <VStack gap={2} hAlign="center" maxWidth={760}>
              <Text type="supporting" color="secondary" justify="center">
                Pricing from ₹699 a month per clinic, 30-day free trial. Questions: <Link href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</Link> · General:{" "}
                <Link href={`mailto:${GENERAL_EMAIL}`}>{GENERAL_EMAIL}</Link>
              </Text>
              <Text type="supporting" color="secondary" justify="center">
                A <Link href={COMPANY_URL}>CraftLayer Studio</Link> product. Source-available under PolyForm Noncommercial 1.0.0; commercial licences:{" "}
                <Link href={`mailto:${LICENSING_EMAIL}`}>{LICENSING_EMAIL}</Link>
              </Text>
            </VStack>
          </VStack>
        </LayoutContent>
      }
    />
  );
}
