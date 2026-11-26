"use client";

import { useState } from "react";
import { Banner } from "@astryxdesign/core/Banner";
import { Card } from "@astryxdesign/core/Card";
import { Center } from "@astryxdesign/core/Center";
import { VStack } from "@astryxdesign/core/Layout";
import { Spinner } from "@astryxdesign/core/Spinner";
import { Switch } from "@astryxdesign/core/Switch";
import { Heading, Text } from "@astryxdesign/core/Text";
import { CONSENT_OPTIONS, type ConsentState } from "@/domain";
import { postJson, useLive } from "@/lib/live";
import { ErrorBanner } from "../ui";

interface Prefs {
  consent: ConsentState;
  phone: string;
  names: string[];
}

/** Patient self-service opt-out. Each change is written to the consent ledger. */
export function PrefsView({ token }: { token: string }) {
  const { data, error, status, refresh } = useLive<Prefs & { now: number }>(`/api/public/prefs/${token}`, null);
  const [saved, setSaved] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  if (!data) {
    return (
      <Center axis="both" padding={10}>
        {status === 404 ? <Banner status="error" title="This link is not valid." /> : error ? <ErrorBanner message={error} /> : <Spinner label="Loading" />}
      </Center>
    );
  }
  return (
    <Center role="main" axis="horizontal" paddingInline={4} paddingBlock={6}>
      <VStack gap={4} width="100%" maxWidth={560}>
        <Heading level={1}>WhatsApp messages from the clinic</Heading>
        <Text color="secondary">
          For {data.phone} ({data.names.join(", ")}). Change any choice at any time; it takes effect immediately.
        </Text>
        <Card padding={5}>
          <VStack gap={4}>
            {CONSENT_OPTIONS.map((o) => (
              <Switch
                key={o.purpose}
                label={o.purpose === "service" ? "Queue and appointment updates" : o.label.replace(" (optional)", "")}
                description={
                  o.purpose === "service"
                    ? "Token, turn alerts, appointment and payment messages. Turning this off means you will not get queue updates on WhatsApp."
                    : o.description
                }
                value={data.consent[o.purpose]}
                changeAction={async (checked) => {
                  setSaveError(null);
                  try {
                    await postJson(`/api/public/prefs/${token}`, { [o.purpose]: checked });
                    setSaved(`${checked ? "Turned on" : "Turned off"}: ${o.label.replace(/ \((optional|required)\)/, "")}`);
                    refresh();
                  } catch (e) {
                    setSaveError((e as Error).message);
                  }
                }}
              />
            ))}
          </VStack>
        </Card>
        {saved ? <Banner status="success" title={saved} /> : null}
        <ErrorBanner message={saveError} />
        <Text type="supporting" color="secondary">
          To correct or delete your details, ask at the clinic reception. The clinic keeps visit records for the period the law requires.
        </Text>
      </VStack>
    </Center>
  );
}
