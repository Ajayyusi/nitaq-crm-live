/**
 * READ-ONLY. Run before deploying the audit fixes.
 *
 * Two new unique indexes guard against double-posting:
 *   - JournalEntry  uniq_posted_entry_per_source   (one POSTED entry per CRM document)
 *   - Enrollment    uniq_enrollment_per_lead       (one registration per lead)
 * MongoDB cannot build a unique index over data that already violates it, and
 * Mongoose only logs that failure, so the protection would silently be absent.
 * This script lists every violation so an accountant can resolve them first
 * (reverse the extra journal entry; merge or unlink the duplicate enrollment).
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/migrations/find-duplicate-postings.ts
 *
 * Exit code 1 when duplicates exist, so it can gate a deploy.
 */
import mongoose from "mongoose";
import JournalEntry from "../../models/accounting/JournalEntry";
import Enrollment from "../../models/Enrollment";

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set (pass --env-file=.env.local).");
  // autoIndex off: importing the models must not build indexes on the target database.
  await mongoose.connect(uri, { autoIndex: false });

  const scanned = await JournalEntry.countDocuments({ status: "Posted", sourceId: { $type: "string" } });
  const dupPostings = await JournalEntry.aggregate<{
    _id: { sourceType: string; sourceId: string };
    count: number;
    entries: { jvNumber: string; date: Date; totalDebit: number }[];
  }>([
    { $match: { status: "Posted", sourceId: { $type: "string" } } },
    {
      $group: {
        _id: { sourceType: "$sourceType", sourceId: "$sourceId" },
        count: { $sum: 1 },
        entries: { $push: { jvNumber: "$jvNumber", date: "$date", totalDebit: "$totalDebit" } },
      },
    },
    { $match: { count: { $gt: 1 } } },
    { $sort: { count: -1 } },
  ]);

  console.log(`\nPosted journal entries with a source document: ${scanned}`);
  console.log(`Source documents with MORE THAN ONE posted entry: ${dupPostings.length}`);
  for (const d of dupPostings) {
    const list = d.entries.map((e) => `${e.jvNumber} (${e.date.toISOString().slice(0, 10)}, AED ${e.totalDebit})`).join(", ");
    console.log(`  ${d._id.sourceType} ${d._id.sourceId}: ${list}`);
  }

  const enrollmentsScanned = await Enrollment.countDocuments({ leadId: { $type: "objectId" } });
  const dupLeads = await Enrollment.aggregate<{ _id: unknown; count: number; ids: string[] }>([
    { $match: { leadId: { $type: "objectId" } } },
    { $group: { _id: "$leadId", count: { $sum: 1 }, ids: { $push: "$enrollmentId" } } },
    { $match: { count: { $gt: 1 } } },
  ]);
  console.log(`\nEnrollments linked to a lead: ${enrollmentsScanned}`);
  console.log(`Leads with MORE THAN ONE enrollment: ${dupLeads.length}`);
  for (const d of dupLeads) console.log(`  lead ${String(d._id)}: ${d.ids.join(", ")}`);

  await mongoose.disconnect();
  if (dupPostings.length || dupLeads.length) {
    console.log("\nResolve these before deploying — the new unique indexes cannot build until they are gone.");
    process.exit(1);
  }
  console.log("\nNo duplicates. Safe to deploy the new indexes.");
}

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect().catch(() => {});
  process.exit(2);
});
