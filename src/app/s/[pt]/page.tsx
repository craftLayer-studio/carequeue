import type { Metadata } from "next";
import { TokenStatusView } from "@/components/patient/TokenStatusView";

export const metadata: Metadata = { title: "Your token", robots: { index: false } };

export default async function StatusPage({ params }: { params: Promise<{ pt: string }> }) {
  const { pt } = await params;
  return <TokenStatusView pt={pt} />;
}
