import { getDb } from "@/server/db/client";
import { handle } from "@/server/http";
import { requireActor } from "@/server/session";
import { dashboard } from "@/server/store";

export async function GET() {
  return handle(async () => dashboard(await getDb(), await requireActor()));
}
