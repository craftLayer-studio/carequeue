import { isIsoDay, istDay } from "@/domain";
import { getDb } from "@/server/db/client";
import { BadRequest, handle } from "@/server/http";
import { requireActor } from "@/server/session";
import { staffAppointments } from "@/server/store";

export async function GET(request: Request) {
  return handle(async () => {
    const actor = await requireActor();
    const day = new URL(request.url).searchParams.get("day") ?? istDay(new Date());
    if (!isIsoDay(day)) throw new BadRequest("day must be YYYY-MM-DD");
    return { now: Date.now(), day, appointments: await staffAppointments(await getDb(), actor, day) };
  });
}
