"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { Divider } from "@astryxdesign/core/Divider";
import { HStack, VStack } from "@astryxdesign/core/Layout";
import { RadioList, RadioListItem } from "@astryxdesign/core/RadioList";
import { Selector } from "@astryxdesign/core/Selector";
import { Spinner } from "@astryxdesign/core/Spinner";
import { Heading, Text } from "@astryxdesign/core/Text";
import { ToggleButton } from "@astryxdesign/core/ToggleButton";
import { postJson } from "@/lib/live";
import { ErrorBanner } from "../ui";
import { ConsentFields, EMPTY_PATIENT, NO_CONSENT, PatientFields, patientErrors } from "../PatientForm";

interface DoctorOption {
  id: string;
  name: string;
  speciality: string;
  fee: string;
  days: { value: string; label: string }[];
}

interface Slot {
  time: string;
  startsAt: string;
  available: boolean;
}

export function BookingForm({ qr, doctors }: { qr: string; doctors: DoctorOption[] }) {
  const router = useRouter();
  const [doctorId, setDoctorId] = useState(doctors[0]?.id ?? "");
  const doctor = doctors.find((d) => d.id === doctorId);
  const [day, setDay] = useState<string | null>(doctor?.days[0]?.value ?? null);
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [startsAt, setStartsAt] = useState<string | null>(null);
  const [patient, setPatient] = useState(EMPTY_PATIENT);
  const [consent, setConsent] = useState(NO_CONSENT);
  const [tried, setTried] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const errors = tried ? patientErrors(patient, consent) : {};

  useEffect(() => {
    if (!doctorId || !day) return;
    let alive = true;
    fetch(`/api/public/${qr}/slots?doctorId=${encodeURIComponent(doctorId)}&day=${day}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j: { slots?: Slot[]; error?: string }) => {
        if (!alive) return;
        setSlots(j.slots ?? []);
        if (j.error) setError(j.error);
      })
      .catch(() => alive && setError("Could not load times. Check your connection."));
    return () => {
      alive = false;
    };
  }, [qr, doctorId, day, reload]);

  async function submit() {
    setTried(true);
    setError(null);
    if (!startsAt) {
      setError("Pick a time");
      return;
    }
    if (Object.keys(patientErrors(patient, consent)).length > 0) return;
    try {
      const res = await postJson<{ publicToken: string }>(`/api/public/${qr}/appointments`, { doctorId, startsAt, ...patient, consent });
      router.push(`/a/${res.publicToken}`);
    } catch (e) {
      setError((e as Error).message);
      setStartsAt(null);
      setReload((n) => n + 1);
    }
  }

  const free = slots?.filter((s) => s.available) ?? [];

  return (
    <Card padding={5}>
      <VStack gap={5}>
        <VStack gap={1}>
          <Heading level={1}>Book an appointment</Heading>
          <Text color="secondary">Pick a doctor and a time. Check in when you arrive and you join the queue in your slot order.</Text>
        </VStack>
        <RadioList
          label="Doctor"
          value={doctorId}
          onChange={(id) => {
            setDoctorId(id);
            setDay(doctors.find((d) => d.id === id)?.days[0]?.value ?? null);
            setSlots(null);
            setStartsAt(null);
          }}>
          {doctors.map((d) => (
            <RadioListItem key={d.id} value={d.id} label={d.name} description={`${d.speciality} · Fee ${d.fee}`} />
          ))}
        </RadioList>
        <Selector
          label="Day"
          options={doctor?.days ?? []}
          value={day ?? undefined}
          hasClear={false}
          onChange={(v) => {
            setDay(v);
            setSlots(null);
            setStartsAt(null);
          }}
        />
        <VStack gap={2}>
          <Text type="label">Time</Text>
          {slots === null ? (
            <Spinner label="Loading times" />
          ) : free.length === 0 ? (
            <Text color="secondary">No free times on this day. Try another day.</Text>
          ) : (
            <HStack gap={2} wrap="wrap">
              {free.map((s) => (
                <ToggleButton key={s.startsAt} label={s.time} isPressed={startsAt === s.startsAt} onPressedChange={() => setStartsAt(s.startsAt)} />
              ))}
            </HStack>
          )}
        </VStack>
        <Divider />
        <PatientFields value={patient} onChange={setPatient} errors={errors} />
        <Divider />
        <ConsentFields value={consent} onChange={setConsent} error={errors.consent} />
        <ErrorBanner message={error} />
        <Button label="Book appointment" variant="primary" size="lg" clickAction={submit} />
      </VStack>
    </Card>
  );
}
