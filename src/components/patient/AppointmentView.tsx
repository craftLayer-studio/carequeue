"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { Center } from "@astryxdesign/core/Center";
import { HStack, VStack } from "@astryxdesign/core/Layout";
import { Link } from "@astryxdesign/core/Link";
import { Spinner } from "@astryxdesign/core/Spinner";
import { Heading, Text } from "@astryxdesign/core/Text";
import { postJson, useLive } from "@/lib/live";
import { PublicFrame } from "../PublicFrame";
import { ErrorBanner, StatusBadge } from "../ui";

interface ApptStatus {
  now: number;
  clinic: { name: string; isDemo: boolean; address: string };
  doctor: { name: string; speciality: string };
  appointment: { status: string; when: string; patientFirstName: string; canCheckIn: boolean; canCancel: boolean };
  tokenLink: string | null;
  prefsToken: string;
}

export function AppointmentView({ pt }: { pt: string }) {
  const router = useRouter();
  const { data, error, status, refresh } = useLive<ApptStatus>(`/api/public/appointments/${pt}`, 30_000);
  const [actionError, setActionError] = useState<string | null>(null);

  if (!data) {
    return (
      <Center axis="both" padding={10}>
        {status === 404 ? <Banner status="error" title="This appointment link is not valid." /> : error ? <ErrorBanner message={error} /> : <Spinner label="Loading" />}
      </Center>
    );
  }
  const a = data.appointment;
  return (
    <PublicFrame clinic={data.clinic.name} isDemo={data.clinic.isDemo}>
      <Card padding={6}>
        <VStack gap={3}>
          <HStack gap={2} hAlign="between" vAlign="center">
            <Text type="supporting" color="secondary">
              Appointment for {a.patientFirstName}
            </Text>
            <StatusBadge status={a.status} />
          </HStack>
          <Heading level={1}>{a.when}</Heading>
          <Text color="secondary">
            {data.doctor.name}, {data.doctor.speciality}
          </Text>
          <Text type="supporting" color="secondary">
            {data.clinic.address}
          </Text>
        </VStack>
      </Card>
      {a.canCheckIn ? (
        <Banner status="info" title="Arrived at the clinic?" description="Check in to join today's queue. Your token and live wait will show on this phone." />
      ) : null}
      <ErrorBanner message={actionError} />
      <HStack gap={3} wrap="wrap">
        {a.canCheckIn ? (
          <Button
            label="I'm here, check me in"
            variant="primary"
            size="lg"
            clickAction={async () => {
              try {
                const res = await postJson<{ statusPath: string }>(`/api/public/appointments/${pt}/check-in`);
                router.push(res.statusPath);
              } catch (e) {
                setActionError((e as Error).message);
              }
            }}
          />
        ) : null}
        {data.tokenLink ? <Button label="See my token" variant="primary" href={data.tokenLink} /> : null}
        {a.canCancel ? (
          <Button
            label="Cancel appointment"
            variant="secondary"
            clickAction={async () => {
              if (!window.confirm("Cancel this appointment?")) return;
              try {
                await postJson(`/api/public/appointments/${pt}/cancel`);
                refresh();
              } catch (e) {
                setActionError((e as Error).message);
              }
            }}
          />
        ) : null}
      </HStack>
      <Link href={`/m/${data.prefsToken}`}>Manage WhatsApp messages</Link>
    </PublicFrame>
  );
}
