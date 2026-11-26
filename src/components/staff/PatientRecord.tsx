"use client";

import { useState } from "react";
import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { Grid } from "@astryxdesign/core/Grid";
import { HStack, VStack } from "@astryxdesign/core/Layout";
import { Link } from "@astryxdesign/core/Link";
import { MetadataList, MetadataListItem } from "@astryxdesign/core/MetadataList";
import { Selector } from "@astryxdesign/core/Selector";
import { Spinner } from "@astryxdesign/core/Spinner";
import { Table } from "@astryxdesign/core/Table";
import { Heading, Text } from "@astryxdesign/core/Text";
import { ToggleButton } from "@astryxdesign/core/ToggleButton";
import { addDays, formatIstDay, formatIstTime, istDay, tokenLabel, type ConsentState } from "@/domain";
import { postJson, useLive } from "@/lib/live";
import { ErrorBanner, StatusBadge } from "../ui";

type Visit = { id: string; day: string; number: number; prefix: string; status: string; reason: string | null; doctorName: string; paymentStatus: string | null; paymentMethod: string | null; amountPaise: number | null };
type Fup = { id: string; dueDate: string; status: string; doctorName: string };
type ConsentRow = { purpose: string; granted: boolean; channel: string; at: string; noticeVersion: string };
type ApptRow = { id: string; startsAt: string; status: string; doctorName: string };

interface PatientRecordData {
  now: number;
  patient: { id: string; name: string; age: number; since: string };
  contact: { phone: string; masked: boolean };
  family: { id: string; name: string; age: number }[];
  consent: ConsentState;
  consentLedger: ConsentRow[];
  visits: Visit[];
  appointments: ApptRow[];
  followUps: Fup[];
}

const PRESETS = [7, 14, 30, 90];

export function PatientRecord({ id, canSetFollowUp, doctors }: { id: string; canSetFollowUp: boolean; doctors: { id: string; name: string }[] }) {
  const { data, error, status, refresh } = useLive<PatientRecordData>(`/api/staff/patients/${id}`, null);
  const [doctorId, setDoctorId] = useState(doctors[0]?.id ?? "");
  const [days, setDays] = useState(14);
  const [msg, setMsg] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  if (!data) return status === 404 ? <Banner status="error" title="Patient not found" /> : error ? <ErrorBanner message={error} /> : <Spinner label="Loading" />;
  const due = addDays(istDay(data.now), days);

  return (
    <VStack gap={5}>
      <HStack gap={2} hAlign="between" vAlign="center" wrap="wrap">
        <VStack gap={0.5}>
          <Heading level={1}>{data.patient.name}</Heading>
          <Text color="secondary">
            {data.patient.age} years · {data.contact.phone}
            {data.contact.masked ? " (masked for your role)" : ""}
          </Text>
        </VStack>
        <Link href="/staff/patients">All patients</Link>
      </HStack>
      <Banner status="info" title="This view was recorded in the audit log." description="CareQueue holds front-desk details only. Clinical notes and prescriptions stay with the doctor." />

      <Grid columns={{ minWidth: 300 }} gap={4}>
        <Card padding={4}>
          <VStack gap={3}>
            <Heading level={2}>Consent</Heading>
            <MetadataList>
              <MetadataListItem label="Visit updates">{data.consent.service ? "Yes" : "No"}</MetadataListItem>
              <MetadataListItem label="Follow-up reminders">{data.consent.reminders ? "Yes" : "No"}</MetadataListItem>
              <MetadataListItem label="Clinic news, reviews">{data.consent.marketing ? "Yes" : "No"}</MetadataListItem>
              <MetadataListItem label="Patient since">{formatIstDay(data.patient.since)}</MetadataListItem>
              <MetadataListItem label="Same mobile">{data.family.length ? data.family.map((f) => `${f.name} (${f.age})`).join(", ") : "No one else"}</MetadataListItem>
            </MetadataList>
          </VStack>
        </Card>
        <Card padding={4}>
          <VStack gap={3}>
            <Heading level={2}>Follow-up</Heading>
            {data.followUps.length ? (
              <Table<Fup>
                data={data.followUps}
                idKey="id"
                density="compact"
                columns={[
                  { key: "dueDate", header: "Due", renderCell: (f) => formatIstDay(f.dueDate) },
                  { key: "doctorName", header: "Doctor" },
                  { key: "status", header: "Status", renderCell: (f) => <StatusBadge status={f.status} /> },
                ]}
              />
            ) : (
              <Text color="secondary">No follow-up set.</Text>
            )}
            {canSetFollowUp && doctors.length ? (
              <VStack gap={2}>
                <Text type="label">Set a follow-up date (practitioner only)</Text>
                {doctors.length > 1 ? (
                  <Selector label="Doctor" options={doctors.map((d) => ({ value: d.id, label: d.name }))} value={doctorId} hasClear={false} onChange={(v) => setDoctorId(v)} />
                ) : null}
                <HStack gap={2} wrap="wrap">
                  {PRESETS.map((d) => (
                    <ToggleButton key={d} label={`${d} days`} isPressed={days === d} onPressedChange={() => setDays(d)} />
                  ))}
                </HStack>
                <Button
                  label={`Set follow-up for ${formatIstDay(due)}`}
                  variant="primary"
                  clickAction={async () => {
                    setActionError(null);
                    try {
                      await postJson(`/api/staff/patients/${id}/followup`, { doctorId, dueDate: due });
                      setMsg(`Follow-up set for ${formatIstDay(due)}. A reminder goes out 2 days before, if the patient opted in.`);
                      refresh();
                    } catch (e) {
                      setActionError((e as Error).message);
                    }
                  }}
                />
              </VStack>
            ) : null}
            {msg ? <Banner status="success" title={msg} /> : null}
            <ErrorBanner message={actionError} />
          </VStack>
        </Card>
      </Grid>

      <VStack gap={2}>
        <Heading level={2}>Visits</Heading>
        <Table<Visit>
          data={data.visits}
          idKey="id"
          emptyState={<Text color="secondary">No visits yet.</Text>}
          columns={[
            { key: "day", header: "Day", renderCell: (v) => formatIstDay(v.day) },
            { key: "number", header: "Token", renderCell: (v) => tokenLabel(v.prefix, v.number) },
            { key: "doctorName", header: "Doctor" },
            { key: "reason", header: "Reason (patient's words)", renderCell: (v) => v.reason ?? "–" },
            { key: "status", header: "Status", renderCell: (v) => <StatusBadge status={v.status} /> },
            { key: "paymentStatus", header: "Fee", renderCell: (v) => (v.paymentStatus ? <StatusBadge status={v.paymentStatus} /> : "–") },
          ]}
        />
      </VStack>

      {data.appointments.length ? (
        <VStack gap={2}>
          <Heading level={2}>Appointments</Heading>
          <Table<ApptRow>
            data={data.appointments}
            idKey="id"
            columns={[
              { key: "startsAt", header: "When", renderCell: (a) => `${formatIstDay(istDay(new Date(a.startsAt)))}, ${formatIstTime(new Date(a.startsAt))}` },
              { key: "doctorName", header: "Doctor" },
              { key: "status", header: "Status", renderCell: (a) => <StatusBadge status={a.status} /> },
            ]}
          />
        </VStack>
      ) : null}

      <VStack gap={2}>
        <Heading level={2}>Consent history</Heading>
        <Table<ConsentRow>
          data={data.consentLedger}
          idKey={(c) => `${c.purpose}-${c.at}-${c.granted}`}
          density="compact"
          columns={[
            { key: "at", header: "When", renderCell: (c) => `${formatIstDay(istDay(new Date(c.at)))}, ${formatIstTime(new Date(c.at))}` },
            { key: "purpose", header: "Purpose" },
            { key: "granted", header: "Choice", renderCell: (c) => (c.granted ? "Granted" : "Withdrawn / not given") },
            { key: "channel", header: "Channel" },
            { key: "noticeVersion", header: "Notice" },
          ]}
        />
      </VStack>
    </VStack>
  );
}
