import { expireStaleHoldsNow } from "../src/server/services/expiry";
import { getDb } from "../src/lib/db/prisma";

async function main() {
  const startedAt = new Date();
  console.log(`[${startedAt.toISOString()}] Running hold expiration job...`);

  try {
    const expiredCount = await expireStaleHoldsNow();
    console.log(
      `✓ Expired ${expiredCount} stale pending reservation${expiredCount === 1 ? "" : "s"}.`,
    );
  } catch (error) {
    console.error("❌ Hold expiration job failed:", error);
    process.exit(1);
  } finally {
    await getDb().$disconnect();
  }
}

main();
