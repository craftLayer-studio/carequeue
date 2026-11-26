import { getDb } from "@/server/db/client";
import { handle } from "@/server/http";
import { requireActor } from "@/server/session";
import { listAudit } from "@/server/store";

export async function GET() {
  return handle(async () => ({ now: Date.now(), entries: await listAudit(await getDb(), await requireActor()) }));
}
