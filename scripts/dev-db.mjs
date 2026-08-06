/**
 * Local dev database — runs an ephemeral MongoDB via mongodb-memory-server
 * (same binary the test suite uses) so the app can run without Atlas.
 * Data lives only while this process is running.
 *
 * Run: node scripts/dev-db.mjs   (then point MONGODB_URI at the printed URI)
 */
import { MongoMemoryServer } from "mongodb-memory-server";

const server = await MongoMemoryServer.create({
  instance: { port: 27019, dbName: "nitaq-crm" },
});

console.log(`READY ${server.getUri()}`);

const stop = async () => {
  await server.stop();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);

// keep the process alive
setInterval(() => {}, 1 << 30);
