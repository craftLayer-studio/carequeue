import { getDb } from "@/server/db/client";
import { clientIp, consent, handle, readBody, registration, str } from "@/server/http";
import { rateLimit } from "@/server/rate-limit";
import { joinFromQr } from "@/server/store";

/** Patient self-registration from the reception QR: returns the live status link token. */
export async function POST(request: Request, ctx: { params: Promise<{ qr: string }> }) {
  return handle(async () => {
    rateLimit(`join:${clientIp(request)}`, 10, 60_000);
    const { qr } = await ctx.params;
    const body = await readBody(request);
    return joinFromQr(await getDb(), qr, { doctorId: str(body, "doctorId", 64), registration: registration(body), consent: consent(body) });
  });
}
