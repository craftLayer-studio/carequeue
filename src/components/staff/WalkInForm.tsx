"use client";

import { useState } from "react";
import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { Collapsible } from "@astryxdesign/core/Collapsible";
import { VStack } from "@astryxdesign/core/Layout";
import { RadioList, RadioListItem } from "@astryxdesign/core/RadioList";
import { Text } from "@astryxdesign/core/Text";
import { postJson } from "@/lib/live";
import { ConsentFields, EMPTY_PATIENT, NO_CONSENT, PatientFields, patientErrors } from "../PatientForm";
import { ErrorBanner } from "../ui";

/** Reception adds a patient who cannot scan the QR (no smartphone). */
export function WalkInForm({ doctors, defaultDoctorId, onAdded }: { doctors: { id: string; name: string }[]; defaultDoctorId: string; onAdded: () => void }) {
  const [doctorId, setDoctorId] = useState(defaultDoctorId);
  const [patient, setPatient] = useState(EMPTY_PATIENT);
  const [consent, setConsent] = useState(NO_CONSENT);
  const [priority, setPriority] = useState("normal");
  const [tried, setTried] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<string | null>(null);
  const errors = tried ? patientErrors(patient, consent) : {};

  async function submit() {
    setTried(true);
    setError(null);
    setAdded(null);
    if (Object.keys(patientErrors(patient, consent)).length > 0) return;
    try {
      const res = await postJson<{ created: boolean }>("/api/staff/walkins", { doctorId, priority, ...patient, consent });
      setAdded(res.created ? `${patient.name} added to the queue. Token sent on WhatsApp (simulated).` : `${patient.name} already has a token today.`);
      setPatient(EMPTY_PATIENT);
      setConsent(NO_CONSENT);
      setTried(false);
      onAdded();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <Card padding={5}>
      <Collapsible trigger={<Text type="large" weight="semibold">Add a walk-in at the desk</Text>} defaultIsOpen={false}>
        <VStack gap={4}>
          <Text color="secondary">For patients who cannot scan the QR. Ask for consent out loud and tick only what they agree to.</Text>
          {doctors.length > 1 ? (
            <RadioList label="Doctor" value={doctorId} onChange={setDoctorId} orientation="horizontal">
              {doctors.map((d) => (
                <RadioListItem key={d.id} value={d.id} label={d.name} />
              ))}
            </RadioList>
          ) : null}
          <PatientFields value={patient} onChange={setPatient} errors={errors} />
          <RadioList label="Front-desk priority" value={priority} onChange={setPriority} orientation="horizontal">
            <RadioListItem value="normal" label="Normal" />
            <RadioListItem value="elderly" label="Elderly" />
            <RadioListItem value="urgent" label="Urgent" />
          </RadioList>
          <ConsentFields value={consent} onChange={setConsent} error={errors.consent} staffMode />
          <ErrorBanner message={error} />
          {added ? <Banner status="success" title={added} /> : null}
          <Button label="Add to queue" variant="primary" clickAction={submit} />
        </VStack>
      </Collapsible>
    </Card>
  );
}
