"use client";

import { useState } from "react";
import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { Grid } from "@astryxdesign/core/Grid";
import { HStack, VStack } from "@astryxdesign/core/Layout";
import { NumberInput } from "@astryxdesign/core/NumberInput";
import { Spinner } from "@astryxdesign/core/Spinner";
import { Switch } from "@astryxdesign/core/Switch";
import { Table } from "@astryxdesign/core/Table";
import { Heading, Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { ROLE_LABEL, type Role } from "@/domain";
import { postJson, useLive } from "@/lib/live";
import { ErrorBanner } from "../ui";

type Clinic = { name: string; city: string; address: string; phone: string; upiVpa: string; upiPayee: string; reviewUrl: string; isDemo: boolean };
type DoctorSettings = { id: string; name: string; speciality: string; qualification: string; registrationNo: string; tokenPrefix: string; feeRupees: number; avgConsultMin: number; slotMinutes: number; sessions: string; active: boolean };
type StaffRow = { id: string; name: string; role: string; active: boolean };

interface SettingsData {
  now: number;
  clinic: Clinic;
  doctors: DoctorSettings[];
  staff: StaffRow[];
}

export function SettingsScreen() {
  const { data, error, refresh } = useLive<SettingsData>("/api/owner/settings", null);
  if (!data) return error ? <ErrorBanner message={error} /> : <Spinner label="Loading settings" />;
  return (
    <VStack gap={6}>
      <Heading level={1}>Settings</Heading>
      <ClinicForm clinic={data.clinic} onSaved={refresh} />
      <VStack gap={3}>
        <Heading level={2}>Doctors and counters</Heading>
        <Grid columns={{ minWidth: 320 }} gap={4}>
          {data.doctors.map((d) => (
            <DoctorForm key={d.id} doctor={d} onSaved={refresh} />
          ))}
        </Grid>
      </VStack>
      <VStack gap={2}>
        <Heading level={2}>Team</Heading>
        <Table<StaffRow>
          data={data.staff}
          idKey="id"
          columns={[
            { key: "name", header: "Name" },
            { key: "role", header: "Role", renderCell: (s) => ROLE_LABEL[s.role as Role] ?? s.role },
            { key: "active", header: "Active", renderCell: (s) => (s.active ? "Yes" : "No") },
          ]}
        />
        <Text type="supporting" color="secondary">
          Receptionists and doctors see full patient mobiles; owner and assistants see masked numbers. Adding staff is done by CareQueue support in the MVP.
        </Text>
      </VStack>
    </VStack>
  );
}

function ClinicForm({ clinic, onSaved }: { clinic: Clinic; onSaved: () => void }) {
  const [v, setV] = useState(clinic);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  return (
    <Card padding={5}>
      <VStack gap={4}>
        <Heading level={2}>Clinic</Heading>
        <Grid columns={{ minWidth: 260 }} gap={4}>
          <TextInput label="Clinic name" value={v.name} onChange={(name) => setV({ ...v, name })} />
          <TextInput label="Address" value={v.address} onChange={(address) => setV({ ...v, address })} />
          <TextInput label="UPI ID for fees" value={v.upiVpa} onChange={(upiVpa) => setV({ ...v, upiVpa })} description="Patients pay this UPI ID from the token page." />
          <TextInput label="UPI payee name" value={v.upiPayee} onChange={(upiPayee) => setV({ ...v, upiPayee })} />
          <TextInput label="Google review link" isOptional value={v.reviewUrl} onChange={(reviewUrl) => setV({ ...v, reviewUrl })} />
        </Grid>
        <HStack gap={2}>
          <Button
            label="Save clinic"
            variant="primary"
            clickAction={async () => {
              setErr(null);
              setMsg(null);
              try {
                await postJson("/api/owner/settings", v);
                setMsg("Saved");
                onSaved();
              } catch (e) {
                setErr((e as Error).message);
              }
            }}
          />
        </HStack>
        {msg ? <Banner status="success" title={msg} /> : null}
        <ErrorBanner message={err} />
      </VStack>
    </Card>
  );
}

function DoctorForm({ doctor, onSaved }: { doctor: DoctorSettings; onSaved: () => void }) {
  const [v, setV] = useState(doctor);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  return (
    <Card padding={4}>
      <VStack gap={3}>
        <VStack gap={0.5}>
          <Heading level={3}>{`${v.name} (token ${v.tokenPrefix})`}</Heading>
          <Text type="supporting" color="secondary">
            {v.qualification} · {v.speciality} · Reg. {v.registrationNo}
          </Text>
        </VStack>
        <NumberInput label="Consultation fee" units="₹" value={v.feeRupees} min={0} max={10000} isIntegerOnly onChange={(feeRupees) => setV({ ...v, feeRupees })} />
        <NumberInput label="Average consultation" units="min" value={v.avgConsultMin} min={2} max={60} isIntegerOnly onChange={(avgConsultMin) => setV({ ...v, avgConsultMin })} description="Used for wait estimates until today's average is known." />
        <NumberInput label="Appointment slot" units="min" value={v.slotMinutes} min={10} max={60} step={5} isIntegerOnly onChange={(slotMinutes) => setV({ ...v, slotMinutes })} />
        <TextInput label="Sessions (IST)" value={v.sessions} onChange={(sessions) => setV({ ...v, sessions })} description="e.g. 09:30-13:30,17:00-20:00" />
        <Switch label="Taking patients" value={v.active} onChange={(active) => setV({ ...v, active })} />
        <Button
          label="Save doctor"
          clickAction={async () => {
            setErr(null);
            setMsg(null);
            try {
              await postJson(`/api/owner/doctors/${v.id}`, { feeRupees: v.feeRupees, avgConsultMin: v.avgConsultMin, slotMinutes: v.slotMinutes, sessions: v.sessions, active: v.active });
              setMsg("Saved");
              onSaved();
            } catch (e) {
              setErr((e as Error).message);
            }
          }}
        />
        {msg ? <Banner status="success" title={msg} /> : null}
        <ErrorBanner message={err} />
      </VStack>
    </Card>
  );
}
