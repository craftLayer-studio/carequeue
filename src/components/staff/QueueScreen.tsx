"use client";

import { useState } from "react";
import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { Grid } from "@astryxdesign/core/Grid";
import { HStack, VStack } from "@astryxdesign/core/Layout";
import { Link } from "@astryxdesign/core/Link";
import { Spinner } from "@astryxdesign/core/Spinner";
import { Tab, TabList } from "@astryxdesign/core/TabList";
import { Table } from "@astryxdesign/core/Table";
import { Heading, Text } from "@astryxdesign/core/Text";
import { postJson, useLive } from "@/lib/live";
import { ErrorBanner, PRIORITY_LABEL, StatTile, StatusBadge } from "../ui";
import { WalkInForm } from "./WalkInForm";

export type QueueRow = {
  id: string;
  label: string;
  status: string;
  kind: string;
  priority: string;
  reason: string | null;
  patientId: string;
  patientName: string;
  age: number;
  phone: string;
  masked: boolean;
  waitedMin: number | null;
  ahead: number | null;
  etaMinutes: number | null;
  payment: { status: string; method: string; amount: string } | null;
};

interface QueueData {
  now: number;
  day: string;
  queues: {
    doctor: { id: string; name: string; speciality: string; fee: string; tokenPrefix: string };
    avgConsultMin: number;
    current: QueueRow | null;
    waiting: QueueRow[];
    skipped: QueueRow[];
    finished: QueueRow[];
  }[];
}

export function QueueScreen({ canCollect }: { canCollect: boolean }) {
  const { data, error, refresh } = useLive<QueueData>("/api/staff/queue");
  const [selected, setSelected] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [upiLink, setUpiLink] = useState<{ label: string; link: string } | null>(null);

  if (!data) return error ? <ErrorBanner message={error} /> : <Spinner label="Loading queue" />;
  if (data.queues.length === 0) return <Banner status="info" title="No active doctor queues for your account." />;
  const q = data.queues.find((x) => x.doctor.id === selected) ?? data.queues[0];

  async function act(url: string, body: Record<string, unknown>, done?: (res: Record<string, unknown>) => void) {
    setActionError(null);
    setNotice(null);
    try {
      const res = await postJson<Record<string, unknown>>(url, body);
      done?.(res);
      refresh();
    } catch (e) {
      setActionError((e as Error).message);
    }
  }
  const tokenAct = (id: string, action: string, extra: Record<string, unknown> = {}) => act(`/api/staff/tokens/${id}`, { action, ...extra });

  const patientCell = (r: QueueRow) => (
    <VStack gap={0.5}>
      <Link href={`/staff/patients/${r.patientId}`}>{r.patientName}</Link>
      <Text type="supporting" color="secondary">
        {r.age} y · {r.phone}
        {r.reason ? ` · ${r.reason}` : ""}
      </Text>
    </VStack>
  );

  return (
    <VStack gap={5}>
      {data.queues.length > 1 ? (
        <TabList value={q.doctor.id} onChange={setSelected} hasDivider>
          {data.queues.map((x) => (
            <Tab key={x.doctor.id} value={x.doctor.id} label={`${x.doctor.name} (${x.waiting.length})`} />
          ))}
        </TabList>
      ) : null}

      <Grid columns={{ minWidth: 180, repeat: "fit" }} gap={4}>
        <StatTile label="Now with doctor" value={q.current?.label ?? "None"} hint={q.current?.patientName} />
        <StatTile label="Waiting" value={q.waiting.length} />
        <StatTile label="Average consultation" value={`${q.avgConsultMin} min`} hint="Rolling, today" />
        <StatTile label="Seen today" value={q.finished.filter((t) => t.status === "done").length} />
      </Grid>

      <Card padding={5}>
        <VStack gap={4}>
          <HStack gap={3} wrap="wrap" vAlign="center" hAlign="between">
            <VStack gap={0.5}>
              <Heading level={2}>{q.doctor.name}</Heading>
              <Text color="secondary">
                {q.doctor.speciality} · Fee {q.doctor.fee}
              </Text>
            </VStack>
            <HStack gap={2} wrap="wrap">
              <Button
                label={q.current ? "Done, call next" : "Call next"}
                variant="primary"
                size="lg"
                isDisabled={q.waiting.length === 0 && !q.current}
                clickAction={() =>
                  act(`/api/staff/queue/${q.doctor.id}/next`, {}, (res) => setNotice(res.called ? `Called ${String(res.called)}` : "Queue is empty"))
                }
              />
              {q.current ? (
                <>
                  <Button label="Mark done" clickAction={() => tokenAct(q.current!.id, "done")} />
                  <Button label="Not here, skip" clickAction={() => tokenAct(q.current!.id, "skip")} />
                </>
              ) : null}
            </HStack>
          </HStack>
          {notice ? <Banner status="success" title={notice} /> : null}
          <ErrorBanner message={actionError} />
          {upiLink ? (
            <Banner
              status="info"
              title={`UPI request sent for ${upiLink.label}`}
              description="The patient got a WhatsApp link (simulated) and sees a Pay button on their token page. Confirm here once the money shows in your UPI app."
              isDismissable
              onDismiss={() => setUpiLink(null)}
            />
          ) : null}
        </VStack>
      </Card>

      <VStack gap={2}>
        <Heading level={3}>Waiting</Heading>
        <Table<QueueRow>
          data={q.waiting}
          idKey="id"
          hasHover
          emptyState={<Text color="secondary">No one waiting.</Text>}
          columns={[
            { key: "label", header: "Token", renderCell: (r) => <Text weight="bold">{r.label}</Text> },
            { key: "patientName", header: "Patient", renderCell: patientCell },
            {
              key: "priority",
              header: "Priority",
              renderCell: (r) => (r.priority === "normal" ? <Text color="secondary">Normal</Text> : <StatusBadge status={r.priority === "urgent" ? "no_show" : "skipped"} />),
            },
            { key: "etaMinutes", header: "Est. wait", renderCell: (r) => <Text hasTabularNumbers>{r.ahead === 0 ? "Next" : `~${r.etaMinutes} min`}</Text> },
            {
              key: "id",
              header: "Actions",
              renderCell: (r) => (
                <HStack gap={1} wrap="wrap">
                  <Button label="Call" size="sm" clickAction={() => tokenAct(r.id, "call")} />
                  <Button
                    label={r.priority === "elderly" ? "Normal" : "Elderly"}
                    size="sm"
                    variant="ghost"
                    clickAction={() => tokenAct(r.id, "priority", { priority: r.priority === "elderly" ? "normal" : "elderly" })}
                  />
                  <Button label="No-show" size="sm" variant="ghost" clickAction={() => tokenAct(r.id, "no_show")} />
                </HStack>
              ),
            },
          ]}
        />
        <Text type="supporting" color="secondary">
          Priority is a front-desk courtesy (elderly, urgent) set by staff, not a medical triage. {PRIORITY_LABEL.urgent} can be set when adding a walk-in.
        </Text>
      </VStack>

      {q.skipped.length > 0 ? (
        <VStack gap={2}>
          <Heading level={3}>Skipped (not present when called)</Heading>
          <Table<QueueRow>
            data={q.skipped}
            idKey="id"
            columns={[
              { key: "label", header: "Token", renderCell: (r) => <Text weight="bold">{r.label}</Text> },
              { key: "patientName", header: "Patient", renderCell: patientCell },
              {
                key: "id",
                header: "Actions",
                renderCell: (r) => (
                  <HStack gap={1} wrap="wrap">
                    <Button label="Back to queue" size="sm" clickAction={() => tokenAct(r.id, "requeue")} />
                    <Button label="Call now" size="sm" variant="ghost" clickAction={() => tokenAct(r.id, "call")} />
                    <Button label="No-show" size="sm" variant="ghost" clickAction={() => tokenAct(r.id, "no_show")} />
                  </HStack>
                ),
              },
            ]}
          />
        </VStack>
      ) : null}

      <VStack gap={2}>
        <Heading level={3}>Seen and closed today</Heading>
        <Table<QueueRow>
          data={[...(q.current ? [q.current] : []), ...q.finished]}
          idKey="id"
          emptyState={<Text color="secondary">Nobody seen yet today.</Text>}
          columns={[
            { key: "label", header: "Token", renderCell: (r) => <Text weight="bold">{r.label}</Text> },
            { key: "patientName", header: "Patient", renderCell: patientCell },
            { key: "status", header: "Status", renderCell: (r) => <StatusBadge status={r.status} /> },
            { key: "waitedMin", header: "Waited", renderCell: (r) => <Text hasTabularNumbers>{r.waitedMin === null ? "–" : `${r.waitedMin} min`}</Text> },
            {
              key: "payment",
              header: "Fee",
              renderCell: (r) => {
                if (r.status === "cancelled" || r.status === "no_show") return <Text color="secondary">–</Text>;
                if (r.payment?.status === "paid") return <Text>{`${r.payment.amount} ${r.payment.method.toUpperCase()}`}</Text>;
                if (!canCollect) return r.payment ? <StatusBadge status={r.payment.status} /> : <Text color="secondary">Not collected</Text>;
                return (
                  <HStack gap={1} wrap="wrap">
                    {r.payment?.status === "pending" ? (
                      <Button label="UPI received" size="sm" variant="primary" clickAction={() => tokenAct(r.id, "confirm_upi")} />
                    ) : (
                      <Button
                        label="UPI link"
                        size="sm"
                        clickAction={() => act(`/api/staff/tokens/${r.id}`, { action: "fee", method: "upi" }, (res) => setUpiLink({ label: r.label, link: String(res.upiLink) }))}
                      />
                    )}
                    <Button label="Cash" size="sm" variant="ghost" clickAction={() => tokenAct(r.id, "fee", { method: "cash" })} />
                  </HStack>
                );
              },
            },
          ]}
        />
      </VStack>

      <WalkInForm doctors={data.queues.map((x) => ({ id: x.doctor.id, name: x.doctor.name }))} defaultDoctorId={q.doctor.id} onAdded={refresh} />
    </VStack>
  );
}
