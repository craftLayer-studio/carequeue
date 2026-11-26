import type { Metadata } from "next";
import { StaffShell } from "@/components/StaffShell";
import { AppointmentsScreen } from "@/components/staff/AppointmentsScreen";
import { staffPage } from "@/server/page";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Appointments", robots: { index: false } };

export default async function Page() {
  const { shell } = await staffPage("appointment:manage", "/staff/appointments");
  return (
    <StaffShell actor={shell} current="/staff/appointments">
      <AppointmentsScreen />
    </StaffShell>
  );
}
