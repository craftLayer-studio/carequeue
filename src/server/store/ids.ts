import { randomBytes, randomUUID } from "node:crypto";

/** Row id with a readable prefix. */
export const newId = (prefix: string) => `${prefix}_${randomUUID().replace(/-/g, "").slice(0, 16)}`;

/** Unguessable URL-safe token for public links and QR codes (128 bits). */
export const randomToken = () => randomBytes(16).toString("base64url");
