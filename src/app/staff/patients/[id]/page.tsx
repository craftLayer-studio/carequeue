import type { Metadata } from "next";
import { StaffShell } from "@/components/StaffShell";
import { PatientRecord } from "@/components/staff/PatientRecord";
import { can } from "@/domain";
import { getDb } from "@/server/db/client";
import { staffPage } from "@/server/page";
import { listDoctors } from "@/server/store";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Patient", robots: { index: false } };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { actor, shell } = await staffPage("patient:view", `/staff/patients/${id}`);
  const doctors = (await listDoctors(await getDb(), actor.orgId))
    .filter((d) => actor.role !== "doctor" || d.id === actor.doctorId)
    .map((d) => ({ id: d.id, name: d.name }));
  return (
    <StaffShell actor={shell} current="/staff/patients">
      <PatientRecord id={id} canSetFollowUp={can(actor.role, "followup:set")} doctors={doctors} />
    </StaffShell>
  );
}
