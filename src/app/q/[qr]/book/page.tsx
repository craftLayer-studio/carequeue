import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicFrame } from "@/components/PublicFrame";
import { BookingForm } from "@/components/patient/BookingForm";
import { formatINR, formatIstDay } from "@/domain";
import { getDb } from "@/server/db/client";
import { bookingInfo, StoreError } from "@/server/store";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Book an appointment", robots: { index: false } };

export default async function BookPage({ params }: { params: Promise<{ qr: string }> }) {
  const { qr } = await params;
  const info = await bookingInfo(await getDb(), qr).catch((e) => {
    if (e instanceof StoreError && e.status === 404) notFound();
    throw e;
  });
  return (
    <PublicFrame clinic={info.clinic.name} isDemo={info.clinic.isDemo}>
      <BookingForm
        qr={qr}
        doctors={info.doctors.map((d) => ({
          id: d.id,
          name: d.name,
          speciality: d.speciality,
          fee: formatINR(d.feePaise),
          days: d.days.map((day) => ({ value: day, label: formatIstDay(day) })),
        }))}
      />
    </PublicFrame>
  );
}
