import type { Metadata } from "next";
import { PrefsView } from "@/components/patient/PrefsView";

export const metadata: Metadata = { title: "Manage messages", robots: { index: false } };

export default async function PrefsPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <PrefsView token={token} />;
}
