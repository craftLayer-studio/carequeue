import { getDb } from "@/server/db/client";
import { handle } from "@/server/http";
import { requireActor } from "@/server/session";
import { listFollowUps } from "@/server/store";

export async function GET() {
  return handle(async () => ({ now: Date.now(), followUps: await listFollowUps(await getDb(), await requireActor()) }));
}
