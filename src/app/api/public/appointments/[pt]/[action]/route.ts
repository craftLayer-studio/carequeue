import { getDb } from "@/server/db/client";
import { BadRequest, clientIp, handle } from "@/server/http";
import { rateLimit } from "@/server/rate-limit";
import { cancelAppointmentByPatient, checkInByPatient } from "@/server/store";

export async function POST(request: Request, ctx: { params: Promise<{ pt: string; action: string }> }) {
  return handle(async () => {
    rateLimit(`appt-act:${clientIp(request)}`, 10, 60_000);
    const { pt, action } = await ctx.params;
    const db = await getDb();
    if (action === "check-in") return checkInByPatient(db, pt);
    if (action === "cancel") return cancelAppointmentByPatient(db, pt);
    throw new BadRequest("Unknown action");
  });
}
