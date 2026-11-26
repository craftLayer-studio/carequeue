"use client";

import { useState } from "react";
import { VStack } from "@astryxdesign/core/Layout";
import { Link } from "@astryxdesign/core/Link";
import { Spinner } from "@astryxdesign/core/Spinner";
import { Table } from "@astryxdesign/core/Table";
import { Heading, Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { useLive } from "@/lib/live";
import { ErrorBanner } from "../ui";

type Row = { id: string; name: string; age: number; phone: string; masked: boolean };

export function PatientsScreen() {
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const { data, error } = useLive<{ now: number; patients: Row[] }>(`/api/staff/patients?q=${encodeURIComponent(query)}`, null);
  return (
    <VStack gap={4}>
      <Heading level={1}>Patients</Heading>
      <TextInput
        label="Search by name or last 4+ digits of mobile"
        type="search"
        value={q}
        onChange={setQ}
        onEnter={() => setQuery(q)}
        hasClear
        width={420}
      />
      <ErrorBanner message={error} />
      {!data ? (
        <Spinner label="Loading" />
      ) : (
        <Table<Row>
          data={data.patients}
          idKey="id"
          hasHover
          emptyState={<Text color="secondary">No patients found.</Text>}
          columns={[
            { key: "name", header: "Name", renderCell: (r) => <Link href={`/staff/patients/${r.id}`}>{r.name}</Link> },
            { key: "age", header: "Age" },
            { key: "phone", header: "Mobile", renderCell: (r) => <Text hasTabularNumbers>{r.phone}</Text> },
          ]}
        />
      )}
      <Text type="supporting" color="secondary">
        Mobile numbers are masked unless you are the receptionist or a doctor. Opening a record is written to the audit log.
      </Text>
    </VStack>
  );
}
