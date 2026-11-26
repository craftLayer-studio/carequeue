import type { Metadata } from "next";
import { AppointmentView } from "@/components/patient/AppointmentView";

export const metadata: Metadata = { title: "Your appointment", robots: { index: false } };

export default async function AppointmentPage({ params }: { params: Promise<{ pt: string }> }) {
  const { pt } = await params;
  return <AppointmentView pt={pt} />;
}
