import { getDb } from "@/server/db/client";
import { handle } from "@/server/http";
import { requireActor } from "@/server/session";
import { searchPatients } from "@/server/store";

export async function GET(request: Request) {
  return handle(async () => {
    const actor = await requireActor();
    const q = new URL(request.url).searchParams.get("q") ?? "";
    return { now: Date.now(), patients: await searchPatients(await getDb(), actor, q) };
  });
}
