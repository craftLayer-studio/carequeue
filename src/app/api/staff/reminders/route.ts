import { getDb } from "@/server/db/client";
import { handle } from "@/server/http";
import { requireActor } from "@/server/session";
import { sendDueReminders } from "@/server/store";

export async function POST() {
  return handle(async () => sendDueReminders(await getDb(), await requireActor()));
}
