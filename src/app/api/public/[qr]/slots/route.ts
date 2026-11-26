import { isIsoDay } from "@/domain";
import { getDb } from "@/server/db/client";
import { BadRequest, clientIp, handle } from "@/server/http";
import { rateLimit } from "@/server/rate-limit";
import { availableSlots } from "@/server/store";

export async function GET(request: Request, ctx: { params: Promise<{ qr: string }> }) {
  return handle(async () => {
    rateLimit(`slots:${clientIp(request)}`, 60, 60_000);
    const { qr } = await ctx.params;
    const url = new URL(request.url);
    const doctorId = url.searchParams.get("doctorId") ?? "";
    const day = url.searchParams.get("day") ?? "";
    if (!doctorId || doctorId.length > 64 || !isIsoDay(day)) throw new BadRequest("doctorId and day (YYYY-MM-DD) are required");
    return availableSlots(await getDb(), qr, doctorId, day);
  });
}
