"use client";

import { useState } from "react";
import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { Center } from "@astryxdesign/core/Center";
import { HStack, VStack } from "@astryxdesign/core/Layout";
import { Link } from "@astryxdesign/core/Link";
import { MetadataList, MetadataListItem } from "@astryxdesign/core/MetadataList";
import { Spinner } from "@astryxdesign/core/Spinner";
import { Heading, Text } from "@astryxdesign/core/Text";
import { PublicFrame } from "../PublicFrame";
import { postJson, useLive } from "@/lib/live";
import { ErrorBanner, StatusBadge } from "../ui";

interface Status {
  now: number;
  clinic: { name: string; isDemo: boolean; phone: string };
  doctor: { name: string; speciality: string };
  token: {
    label: string;
    status: string;
    isToday: boolean;
    patientFirstName: string;
    ahead: number | null;
    etaMinutes: number | null;
    nowServing: string | null;
    avgConsultMin: number;
    waiting: number;
  };
  payment: { status: string; method: string; amount: string; upiLink: string | null } | null;
  prefsToken: string;
}

function headline(t: Status["token"]): { title: string; detail: string } {
  switch (t.status) {
    case "waiting":
      if (t.ahead === 0) return { title: "You are next", detail: "Please be at the reception." };
      return {
        title: `${t.ahead} ${t.ahead === 1 ? "patient" : "patients"} ahead of you`,
        detail: `About ${t.etaMinutes} min. You can wait outside; we will message you when 3 are ahead.`,
      };
    case "called":
      return { title: "Please go in now", detail: "The doctor is ready for you." };
    case "skipped":
      return { title: "You missed your call", detail: "Please tell the reception you are here. They will put you back in the queue." };
    case "done":
      return { title: "Visit complete", detail: "Thank you for visiting." };
    case "no_show":
      return { title: "Marked as not present", detail: "Please speak to the reception if you are still here." };
    default:
      return { title: "Token cancelled", detail: "You can take a new token from the reception QR." };
  }
}

export function TokenStatusView({ pt }: { pt: string }) {
  const { data, error, status, refresh } = useLive<Status>(`/api/public/tokens/${pt}`);
  const [actionError, setActionError] = useState<string | null>(null);

  if (!data) {
    return (
      <Center axis="both" padding={10}>
        {status === 404 ? <Banner status="error" title="This token link is not valid." /> : error ? <ErrorBanner message={error} /> : <Spinner label="Loading your token" />}
      </Center>
    );
  }
  const t = data.token;
  const h = headline(t);
  const active = t.status === "waiting" || t.status === "skipped";

  return (
    <PublicFrame clinic={data.clinic.name} isDemo={data.clinic.isDemo}>
      <Card padding={6}>
        <VStack gap={4} hAlign="center">
          <Text type="supporting" color="secondary">
            Hi {t.patientFirstName}, your token for {data.doctor.name}
          </Text>
          <Text type="display-1" weight="bold" hasTabularNumbers>
            {t.label}
          </Text>
          <StatusBadge status={t.status} />
          <VStack gap={1} hAlign="center">
            <Heading level={1} justify="center">
              {h.title}
            </Heading>
            <Text color="secondary" justify="center">
              {h.detail}
            </Text>
          </VStack>
        </VStack>
      </Card>
      {error ? <ErrorBanner message={error} /> : null}
      <Card padding={4}>
        <MetadataList>
          <MetadataListItem label="Now with doctor">{t.nowServing ?? "No one yet"}</MetadataListItem>
          <MetadataListItem label="Waiting in queue">{String(t.waiting)}</MetadataListItem>
          <MetadataListItem label="Average consultation">{`${t.avgConsultMin} min`}</MetadataListItem>
          <MetadataListItem label="Doctor">{`${data.doctor.name}, ${data.doctor.speciality}`}</MetadataListItem>
        </MetadataList>
      </Card>
      {data.payment ? (
        <Card padding={4}>
          <VStack gap={3}>
            <HStack gap={2} vAlign="center" hAlign="between">
              <Text weight="semibold">Consultation fee {data.payment.amount}</Text>
              <StatusBadge status={data.payment.status} />
            </HStack>
            {data.payment.upiLink ? (
              <VStack gap={2}>
                <Button label={`Pay ${data.payment.amount} with any UPI app`} variant="primary" href={data.payment.upiLink} />
                <Text type="supporting" color="secondary">
                  Opens GPay, PhonePe, Paytm or your bank app. The reception confirms once the money arrives.
                </Text>
              </VStack>
            ) : null}
          </VStack>
        </Card>
      ) : null}
      <ErrorBanner message={actionError} />
      <HStack gap={3} wrap="wrap">
        {active ? (
          <Button
            label="Cancel my token"
            variant="secondary"
            clickAction={async () => {
              if (!window.confirm("Cancel your token? You will lose your place in the queue.")) return;
              try {
                await postJson(`/api/public/tokens/${pt}/cancel`);
                refresh();
              } catch (e) {
                setActionError((e as Error).message);
              }
            }}
          />
        ) : null}
        <Link href={`/m/${data.prefsToken}`}>Manage WhatsApp messages</Link>
      </HStack>
      <Text type="supporting" color="secondary">
        This page updates by itself. Estimates use today&apos;s average consultation time and can change if a patient needs more time.
      </Text>
    </PublicFrame>
  );
}
