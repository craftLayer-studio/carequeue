import { getDb } from "@/server/db/client";
import { clientIp, handle, readBody, str } from "@/server/http";
import { rateLimit } from "@/server/rate-limit";
import { requestOtp } from "@/server/store";

/** Demo: the code is returned and shown on screen, because no SMS is sent in the MVP. */
export async function POST(request: Request) {
  return handle(async () => {
    rateLimit(`otp:${clientIp(request)}`, 5, 60_000);
    const body = await readBody(request);
    const phone = str(body, "phone", 25);
    rateLimit(`otp-phone:${phone.replace(/\D/g, "").slice(-10)}`, 3, 60_000);
    const { demoCode } = await requestOtp(await getDb(), phone);
    return { sent: true, demoCode };
  });
}
