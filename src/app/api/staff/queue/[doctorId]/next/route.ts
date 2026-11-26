import { getDb } from "@/server/db/client";
import { handle } from "@/server/http";
import { requireActor } from "@/server/session";
import { callNext } from "@/server/store";

export async function POST(_request: Request, ctx: { params: Promise<{ doctorId: string }> }) {
  return handle(async () => {
    const actor = await requireActor();
    const { doctorId } = await ctx.params;
    return callNext(await getDb(), actor, doctorId);
  });
}
