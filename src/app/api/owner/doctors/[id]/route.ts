import { getDb } from "@/server/db/client";
import { bool, handle, num, readBody, str } from "@/server/http";
import { requireActor } from "@/server/session";
import { updateDoctor } from "@/server/store";

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const actor = await requireActor();
    const { id } = await ctx.params;
    const body = await readBody(request);
    return updateDoctor(await getDb(), actor, id, {
      feePaise: Math.round(num(body, "feeRupees") * 100),
      avgConsultMin: num(body, "avgConsultMin"),
      slotMinutes: num(body, "slotMinutes"),
      sessions: str(body, "sessions", 60).replace(/\s+/g, ""),
      active: bool(body, "active"),
    });
  });
}
