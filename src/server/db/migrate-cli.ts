/* Apply migrations to the dev PGlite DB (or DATABASE_URL). Usage: pnpm db:migrate */
export {};

async function main() {
  process.env.CAREQUEUE_AUTOSEED = "0";
  const { getDb } = await import("./client");
  await getDb();
  console.log("Migrations applied.");
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
