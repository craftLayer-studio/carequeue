import { getDb } from "@/server/db/client";
import { clientIp, handle } from "@/server/http";
import { rateLimit } from "@/server/rate-limit";
import { cancelTokenByPatient } from "@/server/store";

export async function POST(request: Request, ctx: { params: Promise<{ pt: string }> }) {
  return handle(async () => {
    rateLimit(`cancel:${clientIp(request)}`, 10, 60_000);
    const { pt } = await ctx.params;
    return cancelTokenByPatient(await getDb(), pt);
  });
}
