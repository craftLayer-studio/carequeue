import { getDb } from "@/server/db/client";
import { handle, optStr, readBody, str } from "@/server/http";
import { requireActor } from "@/server/session";
import { settings, updateClinic } from "@/server/store";

export async function GET() {
  return handle(async () => ({ now: Date.now(), ...(await settings(await getDb(), await requireActor())) }));
}

export async function POST(request: Request) {
  return handle(async () => {
    const actor = await requireActor();
    const body = await readBody(request);
    return updateClinic(await getDb(), actor, {
      name: str(body, "name", 80).trim(),
      address: str(body, "address", 160).trim(),
      upiVpa: str(body, "upiVpa", 100).trim(),
      upiPayee: str(body, "upiPayee", 60).trim(),
      reviewUrl: optStr(body, "reviewUrl", 300)?.trim() ?? null,
    });
  });
}
