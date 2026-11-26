import { getDb } from "@/server/db/client";
import { BadRequest, clientIp, consent, handle, readBody, registration, str } from "@/server/http";
import { rateLimit } from "@/server/rate-limit";
import { bookAppointment } from "@/server/store";

export async function POST(request: Request, ctx: { params: Promise<{ qr: string }> }) {
  return handle(async () => {
    rateLimit(`book:${clientIp(request)}`, 6, 60_000);
    const { qr } = await ctx.params;
    const body = await readBody(request);
    const startsAt = new Date(str(body, "startsAt", 40));
    if (Number.isNaN(startsAt.getTime())) throw new BadRequest("startsAt must be an ISO time");
    return bookAppointment(await getDb(), qr, { doctorId: str(body, "doctorId", 64), startsAt, registration: registration(body), consent: consent(body) });
  });
}
