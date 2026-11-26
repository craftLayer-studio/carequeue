import { getDb } from "@/server/db/client";
import { clientIp, handle, readBody, str } from "@/server/http";
import { rateLimit } from "@/server/rate-limit";
import { setSession } from "@/server/session";
import { verifyOtp } from "@/server/store";

export async function POST(request: Request) {
  return handle(async () => {
    rateLimit(`verify:${clientIp(request)}`, 10, 60_000);
    const body = await readBody(request);
    const actor = await verifyOtp(await getDb(), str(body, "phone", 25), str(body, "code", 6));
    await setSession(actor.staffId);
    return { role: actor.role, name: actor.name };
  });
}
