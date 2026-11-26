import type { Metadata } from "next";
import { StaffShell } from "@/components/StaffShell";
import { QueueScreen } from "@/components/staff/QueueScreen";
import { can } from "@/domain";
import { staffPage } from "@/server/page";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Queue", robots: { index: false } };

export default async function StaffQueuePage() {
  const { actor, shell } = await staffPage("queue:operate", "/staff");
  return (
    <StaffShell actor={shell} current="/staff">
      <QueueScreen canCollect={can(actor.role, "payment:collect")} />
    </StaffShell>
  );
}
