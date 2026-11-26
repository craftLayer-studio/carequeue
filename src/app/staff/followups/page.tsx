import type { Metadata } from "next";
import { StaffShell } from "@/components/StaffShell";
import { FollowUpsScreen } from "@/components/staff/FollowUpsScreen";
import { can } from "@/domain";
import { staffPage } from "@/server/page";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Follow-ups", robots: { index: false } };

export default async function Page() {
  const { actor, shell } = await staffPage("patient:view", "/staff/followups");
  return (
    <StaffShell actor={shell} current="/staff/followups">
      <FollowUpsScreen canSend={can(actor.role, "reminders:send")} />
    </StaffShell>
  );
}
