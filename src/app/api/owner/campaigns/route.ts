import { getDb } from "@/server/db/client";
import { BadRequest, bool, handle, readBody, str } from "@/server/http";
import { requireActor } from "@/server/session";
import { sendClinicNotice, sendReviewRequests } from "@/server/store";

/** Owner sends: {kind: "reviews"} or {kind: "notice", text, approvedByPractitioner}. */
export async function POST(request: Request) {
  return handle(async () => {
    const actor = await requireActor();
    const body = await readBody(request);
    const db = await getDb();
    if (body.kind === "reviews") return sendReviewRequests(db, actor);
    if (body.kind === "notice") return sendClinicNotice(db, actor, str(body, "text", 400), bool(body, "approvedByPractitioner"));
    throw new BadRequest("kind must be reviews or notice");
  });
}
