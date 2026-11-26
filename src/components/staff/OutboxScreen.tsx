"use client";

import { Banner } from "@astryxdesign/core/Banner";
import { VStack } from "@astryxdesign/core/Layout";
import { Spinner } from "@astryxdesign/core/Spinner";
import { Table } from "@astryxdesign/core/Table";
import { Heading, Text } from "@astryxdesign/core/Text";
import { formatIstDay, formatIstTime, istDay } from "@/domain";
import { useLive } from "@/lib/live";
import { ErrorBanner, StatusBadge } from "../ui";

type Msg = { id: string; at: number; template: string; purpose: string; status: string; body: string; phone: string };

export function OutboxScreen() {
  const { data, error } = useLive<{ now: number; messages: Msg[] }>("/api/staff/outbox", 10_000);
  return (
    <VStack gap={4}>
      <Heading level={1}>WhatsApp outbox</Heading>
      <Banner
        status="warning"
        title="Simulated messaging"
        description="No WhatsApp message leaves this demo. Every message the clinic would send is written here instead, with the consent check that decided it."
      />
      <ErrorBanner message={error} />
      {!data ? (
        <Spinner label="Loading" />
      ) : (
        <Table<Msg>
          data={data.messages}
          idKey="id"
          verticalAlign="top"
          emptyState={<Text color="secondary">No messages yet.</Text>}
          columns={[
            { key: "at", header: "When", renderCell: (m) => `${formatIstDay(istDay(m.at))}, ${formatIstTime(m.at)}` },
            { key: "phone", header: "To" },
            { key: "template", header: "Type", renderCell: (m) => m.template.replace(/_/g, " ") },
            { key: "body", header: "Message", renderCell: (m) => <Text type="supporting">{m.body}</Text> },
            { key: "status", header: "Result", renderCell: (m) => <StatusBadge status={m.status} /> },
          ]}
        />
      )}
    </VStack>
  );
}
