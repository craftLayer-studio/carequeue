import { PRIORITIES, isQueueAction } from "@/domain";
import { getDb } from "@/server/db/client";
import { BadRequest, handle, oneOf, readBody } from "@/server/http";
import { requireActor } from "@/server/session";
import { actOnToken, collectFee, confirmUpi, setPriority } from "@/server/store";

/** Staff token actions: {action: call|done|skip|requeue|no_show|cancel|priority|fee|confirm_upi}. */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const actor = await requireActor();
    const { id } = await ctx.params;
    const body = await readBody(request);
    const db = await getDb();
    const action = body.action;
    if (action === "priority") return setPriority(db, actor, id, oneOf(body, "priority", PRIORITIES));
    if (action === "fee") return collectFee(db, actor, id, oneOf(body, "method", ["upi", "cash"] as const));
    if (action === "confirm_upi") return confirmUpi(db, actor, id);
    if (isQueueAction(action)) return actOnToken(db, actor, id, action);
    throw new BadRequest("Unknown action");
  });
}
