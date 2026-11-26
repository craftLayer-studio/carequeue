import { getDb } from "@/server/db/client";
import { handle, readBody, str } from "@/server/http";
import { requireActor } from "@/server/session";
import { setFollowUp } from "@/server/store";

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const actor = await requireActor();
    const { id } = await ctx.params;
    const body = await readBody(request);
    return setFollowUp(await getDb(), actor, id, str(body, "doctorId", 64), str(body, "dueDate", 10));
  });
}
