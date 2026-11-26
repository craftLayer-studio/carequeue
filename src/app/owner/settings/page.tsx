import type { Metadata } from "next";
import { StaffShell } from "@/components/StaffShell";
import { SettingsScreen } from "@/components/owner/SettingsScreen";
import { staffPage } from "@/server/page";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Settings", robots: { index: false } };

export default async function Page() {
  const { shell } = await staffPage("settings:manage", "/owner/settings");
  return (
    <StaffShell actor={shell} current="/owner/settings">
      <SettingsScreen />
    </StaffShell>
  );
}
