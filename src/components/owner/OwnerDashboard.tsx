"use client";

import { useState } from "react";
import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { CheckboxInput } from "@astryxdesign/core/CheckboxInput";
import { Grid } from "@astryxdesign/core/Grid";
import { HStack, VStack } from "@astryxdesign/core/Layout";
import { MetadataList, MetadataListItem } from "@astryxdesign/core/MetadataList";
import { Spinner } from "@astryxdesign/core/Spinner";
import { Table } from "@astryxdesign/core/Table";
import { Heading, Text } from "@astryxdesign/core/Text";
import { TextArea } from "@astryxdesign/core/TextArea";
import { formatIstDay, NOTICE_MAX } from "@/domain";
import { postJson, useLive } from "@/lib/live";
import { ErrorBanner, StatTile } from "../ui";

type Day = { day: string; patients: number; seen: number; noShows: number; avgWaitMin: number | null; collected: string };

interface Dashboard {
  now: number;
  today: Day & { collectedUpi: string; collectedCash: string; pendingUpi: string };
  week: { patients: number; seen: number; noShows: number; noShowRate: number; avgWaitMin: number | null; collected: string };
  days: Day[];
  followUps: { total: number; reminded: number; returned: number; dueSoon: number };
  messages: { sent: number; skippedNoConsent: number; reminders: number; marketing: number };
  consent: { contacts: number; service: number; reminders: number; marketing: number };
  upcomingAppointments: number;
}

export function OwnerDashboard() {
  const { data, error, refresh } = useLive<Dashboard>("/api/owner/dashboard", 15_000);
  const [notice, setNotice] = useState("");
  const [approved, setApproved] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);

  if (!data) return error ? <ErrorBanner message={error} /> : <Spinner label="Loading dashboard" />;
  const t = data.today;

  async function send(body: Record<string, unknown>, describe: (r: { sent: number; skippedNoConsent?: number; audience?: number }) => string) {
    setSendError(null);
    setResult(null);
    try {
      const r = await postJson<{ sent: number; skippedNoConsent?: number; audience?: number }>("/api/owner/campaigns", body);
      setResult(describe(r));
      refresh();
    } catch (e) {
      setSendError((e as Error).message);
    }
  }

  return (
    <VStack gap={6}>
      <HStack gap={3} hAlign="between" vAlign="center" wrap="wrap">
        <VStack gap={0.5}>
          <Heading level={1}>Today at the clinic</Heading>
          <Text color="secondary">{formatIstDay(t.day)} · updates every 15 seconds</Text>
        </VStack>
        <HStack gap={2}>
          <Button label="Print reception QR" href="/owner/qr" />
          <Button label="Settings" variant="ghost" href="/owner/settings" />
        </HStack>
      </HStack>

      <Grid columns={{ minWidth: 180, repeat: "fit" }} gap={4}>
        <StatTile label="Patients today" value={t.patients} hint={`${t.seen} seen`} />
        <StatTile label="Average wait today" value={t.avgWaitMin === null ? "–" : `${t.avgWaitMin} min`} hint="Token to call" />
        <StatTile label="No-shows today" value={t.noShows} />
        <StatTile label="Collected today" value={t.collected} hint={`UPI ${t.collectedUpi} · Cash ${t.collectedCash}`} />
      </Grid>
      {t.pendingUpi !== "₹0" ? <Banner status="warning" title={`UPI awaiting confirmation: ${t.pendingUpi}`} description="Check your UPI app and confirm on the queue screen." /> : null}

      <Grid columns={{ minWidth: 180, repeat: "fit" }} gap={4}>
        <StatTile label="Patients, last 7 days" value={data.week.patients} />
        <StatTile label="Average wait, 7 days" value={data.week.avgWaitMin === null ? "–" : `${data.week.avgWaitMin} min`} />
        <StatTile label="No-show rate, 7 days" value={`${data.week.noShowRate}%`} hint={`${data.week.noShows} no-shows`} />
        <StatTile label="Collected, 7 days" value={data.week.collected} />
      </Grid>

      <VStack gap={2}>
        <Heading level={2}>Patients per day</Heading>
        <Table<Day>
          data={[...data.days].reverse()}
          idKey="day"
          columns={[
            { key: "day", header: "Day", renderCell: (d) => formatIstDay(d.day) },
            { key: "patients", header: "Patients", align: "end" },
            { key: "seen", header: "Seen", align: "end" },
            { key: "noShows", header: "No-shows", align: "end" },
            { key: "avgWaitMin", header: "Avg wait", align: "end", renderCell: (d) => (d.avgWaitMin === null ? "–" : `${d.avgWaitMin} min`) },
            { key: "collected", header: "Collected", align: "end" },
          ]}
        />
      </VStack>

      <Grid columns={{ minWidth: 300 }} gap={4}>
        <Card padding={4}>
          <VStack gap={3}>
            <Heading level={2}>Follow-ups</Heading>
            <MetadataList>
              <MetadataListItem label="Due in next 7 days">{String(data.followUps.dueSoon)}</MetadataListItem>
              <MetadataListItem label="Reminded">{String(data.followUps.reminded)}</MetadataListItem>
              <MetadataListItem label="Came back">{`${data.followUps.returned} of ${data.followUps.reminded}`}</MetadataListItem>
              <MetadataListItem label="Upcoming appointments">{String(data.upcomingAppointments)}</MetadataListItem>
            </MetadataList>
            <Button label="Open follow-ups" variant="ghost" href="/staff/followups" />
          </VStack>
        </Card>
        <Card padding={4}>
          <VStack gap={3}>
            <Heading level={2}>Patients and consent</Heading>
            <MetadataList>
              <MetadataListItem label="Patient mobiles">{String(data.consent.contacts)}</MetadataListItem>
              <MetadataListItem label="Opted in to reminders">{String(data.consent.reminders)}</MetadataListItem>
              <MetadataListItem label="Opted in to clinic news">{String(data.consent.marketing)}</MetadataListItem>
              <MetadataListItem label="Messages sent, 7 days">{`${data.messages.sent} (${data.messages.skippedNoConsent} blocked by consent)`}</MetadataListItem>
            </MetadataList>
            <Button label="Open outbox" variant="ghost" href="/staff/outbox" />
          </VStack>
        </Card>
      </Grid>

      <Card padding={5}>
        <VStack gap={4}>
          <Heading level={2}>Send a follow-up to patients</Heading>
          <Text color="secondary">
            Only to patients who ticked &quot;Clinic news and review requests&quot;. No discounts or medical claims: doctors are bound by professional conduct rules on advertising.
          </Text>
          <HStack gap={2} wrap="wrap">
            <Button
              label="Ask today's patients for a review"
              clickAction={() => send({ kind: "reviews" }, (r) => `${r.sent} review request(s) sent (simulated). ${r.skippedNoConsent ?? 0} skipped: no consent.`)}
            />
          </HStack>
          <TextArea
            label="Clinic notice (health camp, holiday hours)"
            value={notice}
            onChange={(v) => setNotice(v.slice(0, NOTICE_MAX))}
            placeholder="Free eye check-up camp this Sunday, 10 am to 1 pm, at the clinic."
            rows={3}
            description={`${notice.length}/${NOTICE_MAX}`}
          />
          <CheckboxInput label="A practitioner has read and approved this notice" value={approved} onChange={setApproved} />
          <HStack gap={2}>
            <Button
              label="Send notice"
              variant="primary"
              isDisabled={!approved || notice.trim().length < 10}
              clickAction={() =>
                send({ kind: "notice", text: notice, approvedByPractitioner: approved }, (r) => {
                  setNotice("");
                  setApproved(false);
                  return `Notice sent to ${r.sent} of ${r.audience ?? 0} patient mobiles (only those who opted in).`;
                })
              }
            />
          </HStack>
          {result ? <Banner status="success" title={result} /> : null}
          <ErrorBanner message={sendError} />
        </VStack>
      </Card>
    </VStack>
  );
}
