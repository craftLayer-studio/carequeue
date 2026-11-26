import { getDb } from "@/server/db/client";
import { clientIp, handle } from "@/server/http";
import { rateLimit } from "@/server/rate-limit";
import { appointmentStatus } from "@/server/store";

export async function GET(request: Request, ctx: { params: Promise<{ pt: string }> }) {
  return handle(async () => {
    rateLimit(`appt:${clientIp(request)}`, 60, 60_000);
    const { pt } = await ctx.params;
    return appointmentStatus(await getDb(), pt);
  });
}
