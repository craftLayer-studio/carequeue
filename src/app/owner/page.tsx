import type { Metadata } from "next";
import { StaffShell } from "@/components/StaffShell";
import { OwnerDashboard } from "@/components/owner/OwnerDashboard";
import { staffPage } from "@/server/page";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Owner dashboard", robots: { index: false } };

export default async function Page() {
  const { shell } = await staffPage("dashboard:view", "/owner");
  return (
    <StaffShell actor={shell} current="/owner">
      <OwnerDashboard />
    </StaffShell>
  );
}
