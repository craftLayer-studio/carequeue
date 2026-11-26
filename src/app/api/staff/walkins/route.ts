import { PRIORITIES } from "@/domain";
import { getDb } from "@/server/db/client";
import { consent, handle, oneOf, readBody, registration, str } from "@/server/http";
import { requireActor } from "@/server/session";
import { addWalkIn } from "@/server/store";

export async function POST(request: Request) {
  return handle(async () => {
    const actor = await requireActor();
    const body = await readBody(request);
    return addWalkIn(await getDb(), actor, {
      doctorId: str(body, "doctorId", 64),
      registration: registration(body),
      consent: consent(body),
      priority: body.priority === undefined ? "normal" : oneOf(body, "priority", PRIORITIES),
    });
  });
}
