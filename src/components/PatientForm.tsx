"use client";

import { Banner } from "@astryxdesign/core/Banner";
import { CheckboxInput } from "@astryxdesign/core/CheckboxInput";
import { Collapsible } from "@astryxdesign/core/Collapsible";
import { VStack } from "@astryxdesign/core/Layout";
import { Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { CONSENT_OPTIONS, PRIVACY_NOTICE, REASON_MAX, validateRegistration, type ConsentState, type FieldErrors } from "@/domain";

export interface PatientDraft {
  name: string;
  phone: string;
  age: string;
  reason: string;
}

export const EMPTY_PATIENT: PatientDraft = { name: "", phone: "", age: "", reason: "" };
export const NO_CONSENT: ConsentState = { service: false, reminders: false, marketing: false };

export function patientErrors(d: PatientDraft, consent: ConsentState): FieldErrors & { consent?: string } {
  const r = validateRegistration(d);
  const errors: FieldErrors & { consent?: string } = r.ok ? {} : { ...r.errors };
  if (!consent.service) errors.consent = "Tick the first box to get a token. The other two are optional.";
  return errors;
}

const err = (m?: string) => (m ? ({ type: "error", message: m } as const) : undefined);

/** Minimum fields only: name, mobile, age and an optional short reason. */
export function PatientFields({
  value,
  onChange,
  errors,
}: {
  value: PatientDraft;
  onChange: (v: PatientDraft) => void;
  errors: FieldErrors;
}) {
  return (
    <VStack gap={4}>
      <TextInput
        label="Patient name"
        value={value.name}
        onChange={(name) => onChange({ ...value, name })}
        autoComplete="name"
        autoCapitalize="words"
        status={err(errors.name)}
      />
      <TextInput
        label="Mobile number"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        description="Your token updates come here on WhatsApp. Family members can share one number."
        value={value.phone}
        onChange={(phone) => onChange({ ...value, phone })}
        status={err(errors.phone)}
      />
      <TextInput
        label="Age (years)"
        inputMode="numeric"
        value={value.age}
        onChange={(age) => onChange({ ...value, age: age.replace(/\D/g, "").slice(0, 3) })}
        status={err(errors.age)}
        width={160}
      />
      <TextInput
        label="Reason for visit"
        isOptional
        placeholder="e.g. Follow-up, Report review"
        description={`A few words only (up to ${REASON_MAX} characters). Please do not type symptoms or medical history.`}
        value={value.reason}
        onChange={(reason) => onChange({ ...value, reason: reason.slice(0, REASON_MAX) })}
        status={err(errors.reason)}
      />
    </VStack>
  );
}

/** Privacy notice plus three separate, unticked consent choices. */
export function ConsentFields({
  value,
  onChange,
  error,
  staffMode = false,
}: {
  value: ConsentState;
  onChange: (v: ConsentState) => void;
  error?: string;
  staffMode?: boolean;
}) {
  return (
    <VStack gap={3}>
      <Text type="label">Your health data and consent</Text>
      {staffMode ? (
        <Banner status="info" title="Read the choices to the patient and tick only what they agree to." />
      ) : null}
      <Collapsible trigger={<Text type="body" weight="medium">How the clinic uses your details</Text>} defaultIsOpen={!staffMode}>
        <VStack gap={2}>
          {PRIVACY_NOTICE.map((line) => (
            <Text key={line} as="p" type="supporting" color="secondary">
              {line}
            </Text>
          ))}
        </VStack>
      </Collapsible>
      {CONSENT_OPTIONS.map((o) => (
        <CheckboxInput
          key={o.purpose}
          label={o.label}
          description={o.description}
          value={value[o.purpose]}
          onChange={(checked) => onChange({ ...value, [o.purpose]: checked })}
        />
      ))}
      {error ? <Banner status="error" title={error} /> : null}
    </VStack>
  );
}
