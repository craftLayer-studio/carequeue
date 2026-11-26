import type { Metadata, Viewport } from "next";
import "@astryxdesign/core/reset.css";
import "@astryxdesign/core/astryx.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  metadataBase: new URL("https://carequeue.craftlayer.store"),
  title: { default: "CareQueue: wait from anywhere", template: "%s | CareQueue" },
  description:
    "QR token queue, live wait on the patient's phone, appointment booking, follow-up reminders and fee collection for small clinics in India.",
  robots: { index: true, follow: true },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
