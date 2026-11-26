import { getDb } from "@/server/db/client";
import { clientIp, handle } from "@/server/http";
import { requireActor } from "@/server/session";
import { viewPatient } from "@/server/store";

/** Opening a record writes an audit log row. */
export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const actor = await requireActor();
    const { id } = await ctx.params;
    return { now: Date.now(), ...(await viewPatient(await getDb(), actor, id, clientIp(request))) };
  });
}
