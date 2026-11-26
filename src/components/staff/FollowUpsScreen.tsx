"use client";

import { useState } from "react";
import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { HStack, VStack } from "@astryxdesign/core/Layout";
import { Link } from "@astryxdesign/core/Link";
import { Spinner } from "@astryxdesign/core/Spinner";
import { Table } from "@astryxdesign/core/Table";
import { Heading, Text } from "@astryxdesign/core/Text";
import { formatIstDay } from "@/domain";
import { postJson, useLive } from "@/lib/live";
import { ErrorBanner, StatusBadge } from "../ui";

type Row = { id: string; dueDate: string; status: string; patientId: string; patientName: string; doctorName: string; phone: string };

export function FollowUpsScreen({ canSend }: { canSend: boolean }) {
  const { data, error, refresh } = useLive<{ now: number; followUps: Row[] }>("/api/staff/followups", null);
  const [result, setResult] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  return (
    <VStack gap={4}>
      <HStack gap={3} hAlign="between" vAlign="center" wrap="wrap">
        <VStack gap={0.5}>
          <Heading level={1}>Follow-ups and reminders</Heading>
          <Text color="secondary">Dates are set by the doctor. Reminders go only to patients who opted in.</Text>
        </VStack>
        {canSend ? (
          <Button
            label="Send due reminders now"
            variant="primary"
            clickAction={async () => {
              setActionError(null);
              try {
                const r = await postJson<{ sent: number; skippedNoConsent: number }>("/api/staff/reminders");
                setResult(`${r.sent} reminder(s) sent (simulated WhatsApp). ${r.skippedNoConsent} not sent because the patient did not opt in.`);
                refresh();
              } catch (e) {
                setActionError((e as Error).message);
              }
            }}
          />
        ) : null}
      </HStack>
      {result ? (
        <Banner status="success" title={result} endContent={<Link href="/staff/outbox">Open outbox</Link>} />
      ) : null}
      <ErrorBanner message={actionError ?? error} />
      {!data ? (
        <Spinner label="Loading" />
      ) : (
        <Table<Row>
          data={data.followUps}
          idKey="id"
          hasHover
          emptyState={<Text color="secondary">No follow-ups set.</Text>}
          columns={[
            { key: "dueDate", header: "Due", renderCell: (r) => formatIstDay(r.dueDate) },
            { key: "patientName", header: "Patient", renderCell: (r) => <Link href={`/staff/patients/${r.patientId}`}>{r.patientName}</Link> },
            { key: "phone", header: "Mobile" },
            { key: "doctorName", header: "Doctor" },
            { key: "status", header: "Status", renderCell: (r) => <StatusBadge status={r.status} /> },
          ]}
        />
      )}
      <Text type="supporting" color="secondary">
        In production reminders run on a schedule each morning. Appointment reminders for today and tomorrow are sent in the same run.
      </Text>
    </VStack>
  );
}
