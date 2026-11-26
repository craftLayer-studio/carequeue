import { getDb } from "@/server/db/client";
import { clientIp, handle } from "@/server/http";
import { rateLimit } from "@/server/rate-limit";
import { tokenStatus } from "@/server/store";

export async function GET(request: Request, ctx: { params: Promise<{ pt: string }> }) {
  return handle(async () => {
    rateLimit(`status:${clientIp(request)}`, 120, 60_000);
    const { pt } = await ctx.params;
    return tokenStatus(await getDb(), pt);
  });
}
