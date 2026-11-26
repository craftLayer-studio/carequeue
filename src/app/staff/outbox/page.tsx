import type { Metadata } from "next";
import { StaffShell } from "@/components/StaffShell";
import { OutboxScreen } from "@/components/staff/OutboxScreen";
import { staffPage } from "@/server/page";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "WhatsApp outbox", robots: { index: false } };

export default async function Page() {
  const { shell } = await staffPage("outbox:view", "/staff/outbox");
  return (
    <StaffShell actor={shell} current="/staff/outbox">
      <OutboxScreen />
    </StaffShell>
  );
}
