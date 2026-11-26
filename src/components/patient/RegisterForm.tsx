"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { Divider } from "@astryxdesign/core/Divider";
import { VStack } from "@astryxdesign/core/Layout";
import { Link } from "@astryxdesign/core/Link";
import { RadioList, RadioListItem } from "@astryxdesign/core/RadioList";
import { Heading, Text } from "@astryxdesign/core/Text";
import { postJson } from "@/lib/live";
import { ErrorBanner } from "../ui";
import { ConsentFields, EMPTY_PATIENT, NO_CONSENT, PatientFields, patientErrors } from "../PatientForm";

export function RegisterForm({ qr, doctors }: { qr: string; doctors: { id: string; name: string; speciality: string }[] }) {
  const router = useRouter();
  const [doctorId, setDoctorId] = useState(doctors.length === 1 ? doctors[0].id : "");
  const [patient, setPatient] = useState(EMPTY_PATIENT);
  const [consent, setConsent] = useState(NO_CONSENT);
  const [tried, setTried] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const errors = tried ? patientErrors(patient, consent) : {};
  const doctorError = tried && !doctorId ? "Choose who you are here to see" : undefined;

  async function submit() {
    setTried(true);
    setError(null);
    if (!doctorId || Object.keys(patientErrors(patient, consent)).length > 0) return;
    try {
      const res = await postJson<{ publicToken: string }>(`/api/public/${qr}/tokens`, { doctorId, ...patient, consent });
      router.push(`/s/${res.publicToken}`);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <Card padding={5}>
      <VStack gap={5}>
        <VStack gap={1}>
          <Heading level={1}>Get your token</Heading>
          <Text color="secondary">No app, no standing at the counter. Your place in the queue shows on this phone.</Text>
        </VStack>
        <RadioList
          label="Doctor"
          value={doctorId}
          onChange={setDoctorId}
          status={doctorError ? { type: "error", message: doctorError } : undefined}>
          {doctors.map((d) => (
            <RadioListItem key={d.id} value={d.id} label={d.name} description={d.speciality} />
          ))}
        </RadioList>
        <PatientFields value={patient} onChange={setPatient} errors={errors} />
        <Divider />
        <ConsentFields value={consent} onChange={setConsent} error={errors.consent} />
        <ErrorBanner message={error} />
        <Button label="Get my token" variant="primary" size="lg" clickAction={submit} />
        <Text type="supporting" color="secondary">
          Have an appointment later? <Link href={`/q/${qr}/book`}>Book a time instead</Link>.
        </Text>
      </VStack>
    </Card>
  );
}
