/**
 * READ-ONLY full logical backup of the database in MONGODB_URI.
 *
 * Writes every collection as Extended JSON (types preserved: ObjectId, Date,
 * Decimal128) plus its index definitions to backups/<db>-<UTC timestamp>/.
 * Free (M0) Atlas clusters have no snapshots, so this is the backup to take
 * before any deploy or migration. The URI is never printed.
 *
 * Usage:
 *   npx tsx --env-file=.env.production.local scripts/ops/backup-db.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import mongoose from "mongoose";

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set (pass --env-file=.env.production.local).");

  await mongoose.connect(uri, { autoIndex: false, readPreference: "secondaryPreferred" });
  const db = mongoose.connection.db;
  if (!db) throw new Error("No database handle after connect.");
  const { EJSON } = mongoose.mongo.BSON;

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dir = join(process.cwd(), "backups", `${db.databaseName}-${stamp}`);
  mkdirSync(dir, { recursive: true });

  const collections = (await db.listCollections({}, { nameOnly: true }).toArray())
    .map((c) => c.name)
    .filter((name) => !name.startsWith("system."))
    .sort();

  const manifest: { collection: string; documents: number; indexes: number }[] = [];
  for (const name of collections) {
    const col = db.collection(name);
    const docs = await col.find({}).toArray();
    const indexes = await col.indexes();
    writeFileSync(join(dir, `${name}.json`), EJSON.stringify(docs, undefined, 0, { relaxed: false }));
    writeFileSync(join(dir, `${name}.indexes.json`), JSON.stringify(indexes, null, 2));
    const counted = await col.countDocuments();
    if (counted !== docs.length) throw new Error(`${name}: exported ${docs.length} but collection now has ${counted}; rerun.`);
    manifest.push({ collection: name, documents: docs.length, indexes: indexes.length });
  }

  writeFileSync(
    join(dir, "manifest.json"),
    JSON.stringify({ database: db.databaseName, takenAt: new Date().toISOString(), collections: manifest }, null, 2)
  );
  console.table(manifest);
  console.log(`Backup written to ${dir}`);
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err instanceof Error ? err.message : err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
