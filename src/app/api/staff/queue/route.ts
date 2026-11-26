import { getDb } from "@/server/db/client";
import { handle } from "@/server/http";
import { requireActor } from "@/server/session";
import { staffQueues } from "@/server/store";

export async function GET() {
  return handle(async () => staffQueues(await getDb(), await requireActor()));
}
