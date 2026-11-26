import { getDb } from "@/server/db/client";
import { clientIp, consentPatch, handle, readBody } from "@/server/http";
import { rateLimit } from "@/server/rate-limit";
import { prefsByToken, updatePrefsByToken } from "@/server/store";

export async function GET(request: Request, ctx: { params: Promise<{ token: string }> }) {
  return handle(async () => {
    rateLimit(`prefs:${clientIp(request)}`, 30, 60_000);
    const { token } = await ctx.params;
    const { consent, phone, names } = await prefsByToken(await getDb(), token);
    return { consent, phone, names };
  });
}

export async function POST(request: Request, ctx: { params: Promise<{ token: string }> }) {
  return handle(async () => {
    rateLimit(`prefs:${clientIp(request)}`, 30, 60_000);
    const { token } = await ctx.params;
    return { consent: await updatePrefsByToken(await getDb(), token, consentPatch(await readBody(request))) };
  });
}
