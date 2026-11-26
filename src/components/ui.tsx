"use client";

import { Badge } from "@astryxdesign/core/Badge";
import { Banner } from "@astryxdesign/core/Banner";
import { Card } from "@astryxdesign/core/Card";
import { VStack } from "@astryxdesign/core/Layout";
import { Text } from "@astryxdesign/core/Text";

export function DemoBadge() {
  return <Badge variant="warning" label="Demo" />;
}

export function ErrorBanner({ message }: { message?: string | null }) {
  if (!message) return null;
  return <Banner status="error" title={message} />;
}

export function StatTile({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <Card padding={4}>
      <VStack gap={1}>
        <Text type="supporting" color="secondary">
          {label}
        </Text>
        <Text size="2xl" weight="bold" hasTabularNumbers>
          {value}
        </Text>
        {hint ? (
          <Text type="supporting" color="secondary">
            {hint}
          </Text>
        ) : null}
      </VStack>
    </Card>
  );
}

const TOKEN_STATUS: Record<string, { label: string; variant: "neutral" | "info" | "success" | "warning" | "error" }> = {
  waiting: { label: "Waiting", variant: "info" },
  called: { label: "With doctor", variant: "success" },
  done: { label: "Done", variant: "neutral" },
  skipped: { label: "Skipped", variant: "warning" },
  no_show: { label: "No-show", variant: "error" },
  cancelled: { label: "Cancelled", variant: "neutral" },
  booked: { label: "Booked", variant: "info" },
  checked_in: { label: "Checked in", variant: "success" },
  scheduled: { label: "Scheduled", variant: "info" },
  reminded: { label: "Reminded", variant: "warning" },
  returned: { label: "Returned", variant: "success" },
  pending: { label: "UPI pending", variant: "warning" },
  paid: { label: "Paid", variant: "success" },
  sent: { label: "Sent (simulated)", variant: "success" },
  skipped_no_consent: { label: "Not sent: no consent", variant: "neutral" },
};

export function StatusBadge({ status }: { status: string }) {
  const s = TOKEN_STATUS[status] ?? { label: status, variant: "neutral" as const };
  return <Badge variant={s.variant} label={s.label} />;
}

export const PRIORITY_LABEL: Record<string, string> = { normal: "Normal", elderly: "Elderly", urgent: "Urgent" };
