import type { Metadata } from "next";
import { QrSheet } from "@/components/owner/QrSheet";
import { getDb } from "@/server/db/client";
import { staffPage } from "@/server/page";
import { qrSheet } from "@/server/store";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Reception QR sheet", robots: { index: false } };

export default async function Page() {
  const { actor } = await staffPage("settings:manage", "/owner/qr");
  const sheet = await qrSheet(await getDb(), actor);
  return (
    <QrSheet
      clinic={sheet.clinic}
      isDemo={sheet.isDemo}
      tokenUrl={sheet.tokenUrl}
      bookUrl={sheet.bookUrl}
      tokenImg={`data:image/svg+xml;base64,${Buffer.from(sheet.tokenSvg).toString("base64")}`}
      bookImg={`data:image/svg+xml;base64,${Buffer.from(sheet.bookSvg).toString("base64")}`}
    />
  );
}
