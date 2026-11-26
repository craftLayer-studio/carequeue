/* Reset and seed the demo clinic. Usage: pnpm db:seed */
export {};

async function main() {
  process.env.CAREQUEUE_AUTOSEED = "0";
  const { getDb } = await import("./client");
  const { resetDatabase, seedDemo } = await import("./seed");
  const db = await getDb();
  await resetDatabase(db);
  const { qrToken } = await seedDemo(db);
  console.log(`Seeded demo clinic. Reception QR path: /q/${qrToken}`);
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
