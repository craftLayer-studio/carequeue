import type { Permission } from "@/domain";
import { getDb } from "./db/client";
import { pageActor } from "./session";
import { getOrg } from "./store/clinic";

/** Server-side guard for staff/owner pages: signed-in actor with permission, plus shell props. */
export async function staffPage(permission: Permission, path: string) {
  const actor = await pageActor(permission, path);
  const org = await getOrg(await getDb(), actor.orgId);
  return { actor, shell: { name: actor.name, role: actor.role, clinic: org.name }, isDemo: org.isDemo };
}
