import type { Metadata } from "next";
import { StaffShell } from "@/components/StaffShell";
import { PatientsScreen } from "@/components/staff/PatientsScreen";
import { staffPage } from "@/server/page";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Patients", robots: { index: false } };

export default async function Page() {
  const { shell } = await staffPage("patient:view", "/staff/patients");
  return (
    <StaffShell actor={shell} current="/staff/patients">
      <PatientsScreen />
    </StaffShell>
  );
}
