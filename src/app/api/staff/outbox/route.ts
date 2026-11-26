import { getDb } from "@/server/db/client";
import { handle } from "@/server/http";
import { requireActor } from "@/server/session";
import { listOutbox } from "@/server/store";

export async function GET() {
  return handle(async () => ({ now: Date.now(), messages: await listOutbox(await getDb(), await requireActor()) }));
}
