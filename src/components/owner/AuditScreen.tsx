"use client";

import { VStack } from "@astryxdesign/core/Layout";
import { Spinner } from "@astryxdesign/core/Spinner";
import { Table } from "@astryxdesign/core/Table";
import { Heading, Text } from "@astryxdesign/core/Text";
import { formatIstDay, formatIstTime, istDay } from "@/domain";
import { useLive } from "@/lib/live";
import { ErrorBanner } from "../ui";

type Entry = { id: string; at: number; action: string; entity: string; entityId: string; staffName: string; role: string };

export function AuditScreen() {
  const { data, error } = useLive<{ now: number; entries: Entry[] }>("/api/owner/audit", 15_000);
  return (
    <VStack gap={4}>
      <Heading level={1}>Audit log</Heading>
      <Text color="secondary">Every patient record view and every queue, payment and settings action, newest first. Kept for at least one year.</Text>
      <ErrorBanner message={error} />
      {!data ? (
        <Spinner label="Loading" />
      ) : (
        <Table<Entry>
          data={data.entries}
          idKey="id"
          density="compact"
          emptyState={<Text color="secondary">Nothing logged yet.</Text>}
          columns={[
            { key: "at", header: "When", renderCell: (e) => `${formatIstDay(istDay(e.at))}, ${formatIstTime(e.at)}` },
            { key: "staffName", header: "Who", renderCell: (e) => `${e.staffName}${e.role ? ` (${e.role})` : ""}` },
            { key: "action", header: "Action" },
            { key: "entity", header: "Record", renderCell: (e) => `${e.entity} ${e.entityId.slice(-6)}` },
          ]}
        />
      )}
    </VStack>
  );
}
