"use client";

import { useState } from "react";
import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { HStack, VStack } from "@astryxdesign/core/Layout";
import { Link } from "@astryxdesign/core/Link";
import { Spinner } from "@astryxdesign/core/Spinner";
import { Table } from "@astryxdesign/core/Table";
import { Heading, Text } from "@astryxdesign/core/Text";
import { ToggleButton } from "@astryxdesign/core/ToggleButton";
import { addDays, formatIstDay, istDay } from "@/domain";
import { postJson, useLive } from "@/lib/live";
import { ErrorBanner, StatusBadge } from "../ui";

type Appt = {
  id: string;
  time: string;
  status: string;
  doctorName: string;
  patientId: string;
  patientName: string;
  age: number;
  reason: string | null;
  phone: string;
};

export function AppointmentsScreen() {
  const [today] = useState(() => istDay(new Date()));
  const [day, setDay] = useState(today);
  const { data, error, refresh } = useLive<{ now: number; appointments: Appt[] }>(`/api/staff/appointments?day=${day}`, 15_000);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function act(id: string, action: string) {
    setActionError(null);
    setNotice(null);
    try {
      const res = await postJson<{ token?: string }>(`/api/staff/appointments/${id}`, { action });
      if (res.token) setNotice(`Checked in. Token ${res.token} issued and sent on WhatsApp (simulated).`);
      refresh();
    } catch (e) {
      setActionError((e as Error).message);
    }
  }

  return (
    <VStack gap={4}>
      <Heading level={1}>Appointments</Heading>
      <HStack gap={2} wrap="wrap">
        {Array.from({ length: 7 }, (_, i) => addDays(today, i)).map((d) => (
          <ToggleButton key={d} label={i18nDay(d, today)} isPressed={d === day} onPressedChange={() => setDay(d)} />
        ))}
      </HStack>
      {notice ? <Banner status="success" title={notice} /> : null}
      <ErrorBanner message={actionError ?? error} />
      {!data ? (
        <Spinner label="Loading" />
      ) : (
        <Table<Appt>
          data={data.appointments}
          idKey="id"
          hasHover
          emptyState={<Text color="secondary">No appointments on this day.</Text>}
          columns={[
            { key: "time", header: "Time", renderCell: (a) => <Text weight="semibold">{a.time}</Text> },
            {
              key: "patientName",
              header: "Patient",
              renderCell: (a) => (
                <VStack gap={0.5}>
                  <Link href={`/staff/patients/${a.patientId}`}>{a.patientName}</Link>
                  <Text type="supporting" color="secondary">
                    {a.age} y · {a.phone}
                    {a.reason ? ` · ${a.reason}` : ""}
                  </Text>
                </VStack>
              ),
            },
            { key: "doctorName", header: "Doctor" },
            { key: "status", header: "Status", renderCell: (a) => <StatusBadge status={a.status} /> },
            {
              key: "id",
              header: "Actions",
              renderCell: (a) =>
                a.status === "booked" ? (
                  <HStack gap={1} wrap="wrap">
                    {day === today ? <Button label="Check in" size="sm" variant="primary" clickAction={() => act(a.id, "check_in")} /> : null}
                    <Button label="No-show" size="sm" variant="ghost" clickAction={() => act(a.id, "no_show")} />
                    <Button label="Cancel" size="sm" variant="ghost" clickAction={() => act(a.id, "cancel")} />
                  </HStack>
                ) : null,
            },
          ]}
        />
      )}
      <Text type="supporting" color="secondary">
        Patients book from the clinic link and get a WhatsApp confirmation. Run reminders from Follow-ups to remind tomorrow&apos;s appointments.
      </Text>
    </VStack>
  );
}

function i18nDay(d: string, today: string) {
  if (d === today) return "Today";
  if (d === addDays(today, 1)) return "Tomorrow";
  return formatIstDay(d);
}
