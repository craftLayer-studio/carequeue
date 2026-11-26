import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicFrame } from "@/components/PublicFrame";
import { RegisterForm } from "@/components/patient/RegisterForm";
import { getDb } from "@/server/db/client";
import { bookingInfo, StoreError } from "@/server/store";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Get your token", robots: { index: false } };

export default async function QrPage({ params }: { params: Promise<{ qr: string }> }) {
  const { qr } = await params;
  const info = await bookingInfo(await getDb(), qr).catch((e) => {
    if (e instanceof StoreError && e.status === 404) notFound();
    throw e;
  });
  return (
    <PublicFrame clinic={info.clinic.name} isDemo={info.clinic.isDemo}>
      <RegisterForm qr={qr} doctors={info.doctors.map((d) => ({ id: d.id, name: d.name, speciality: d.speciality }))} />
    </PublicFrame>
  );
}
