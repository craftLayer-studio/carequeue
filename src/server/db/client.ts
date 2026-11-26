import { mkdirSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { migrate as migratePg } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import * as schema from "./schema";

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;
/** A database handle or an open transaction: store functions accept either. */
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0] | Db;

const MIGRATIONS = path.join(process.cwd(), "drizzle");

/** In-memory PGlite with migrations applied. Used by tests. */
export async function createMemoryDb(): Promise<Db> {
  const client = new PGlite();
  const db = drizzlePglite({ client, schema });
  await migratePglite(db, { migrationsFolder: MIGRATIONS });
  return db as unknown as Db;
}

async function createAppDb(): Promise<Db> {
  const url = process.env.DATABASE_URL;
  if (url) {
    const db = drizzlePg({ client: new Pool({ connectionString: url, max: 5 }), schema });
    await migratePg(db, { migrationsFolder: MIGRATIONS });
    return db as unknown as Db;
  }
  const dir = process.env.PGLITE_DIR ?? path.join(process.cwd(), ".data", "pglite");
  mkdirSync(path.dirname(dir), { recursive: true });
  const client = new PGlite(dir);
  const db = drizzlePglite({ client, schema });
  await migratePglite(db, { migrationsFolder: MIGRATIONS });
  return db as unknown as Db;
}

const globalForDb = globalThis as unknown as { __carequeueDb?: Promise<Db> };

/**
 * The app database, created once per process (survives dev hot reloads). Postgres when
 * DATABASE_URL is set, otherwise a PGlite file DB in ./.data/pglite. An empty dev DB is seeded
 * with the demo clinic on first use.
 */
export function getDb(): Promise<Db> {
  if (!globalForDb.__carequeueDb) {
    globalForDb.__carequeueDb = (async () => {
      const db = await createAppDb();
      if (process.env.CAREQUEUE_AUTOSEED !== "0") {
        const { seedIfEmpty } = await import("./seed");
        await seedIfEmpty(db);
      }
      return db;
    })().catch((err) => {
      globalForDb.__carequeueDb = undefined;
      throw err;
    });
  }
  return globalForDb.__carequeueDb;
}
