import { getDb } from "@/server/db/client";
import { handle, oneOf, readBody } from "@/server/http";
import { requireActor } from "@/server/session";
import { staffAppointmentAction } from "@/server/store";

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const actor = await requireActor();
    const { id } = await ctx.params;
    const body = await readBody(request);
    return staffAppointmentAction(await getDb(), actor, id, oneOf(body, "action", ["check_in", "cancel", "no_show"] as const));
  });
}
