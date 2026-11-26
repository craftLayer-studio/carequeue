import type { Metadata } from "next";
import { StaffShell } from "@/components/StaffShell";
import { AuditScreen } from "@/components/owner/AuditScreen";
import { staffPage } from "@/server/page";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Audit log", robots: { index: false } };

export default async function Page() {
  const { shell } = await staffPage("audit:view", "/owner/audit");
  return (
    <StaffShell actor={shell} current="/owner/audit">
      <AuditScreen />
    </StaffShell>
  );
}
