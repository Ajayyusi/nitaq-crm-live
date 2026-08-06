/**
 * Dev-only seed: admin user + official Chart of Accounts + accounting settings.
 * Meant for the ephemeral local DB started by scripts/dev-db.mjs.
 *
 * Run: SEED_ADMIN_PASSWORD='...' npx tsx scripts/seed-dev.ts
 * Env: MONGODB_URI (default mongodb://127.0.0.1:27019/nitaq-crm),
 *      SEED_ADMIN_EMAIL (default admin@nitaq.local), SEED_ADMIN_PASSWORD (required, ≥12 chars)
 */
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { COA_SEED } from "../lib/accounting/coa-seed";
import ChartOfAccount from "../models/accounting/ChartOfAccount";
import AccountingSettings from "../models/accounting/AccountingSettings";

const uri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27019/nitaq-crm";
const email = (process.env.SEED_ADMIN_EMAIL || "admin@nitaq.local").toLowerCase().trim();
const password = process.env.SEED_ADMIN_PASSWORD;

if (!password || password.length < 12) {
  console.error("❌  Set SEED_ADMIN_PASSWORD (at least 12 characters).");
  process.exit(1);
}

const UserSchema = new mongoose.Schema(
  {
    name: String,
    email: { type: String, unique: true, lowercase: true },
    password: String,
    role: String,
    active: { type: Boolean, default: true },
    phone: String,
  },
  { timestamps: true }
);
const User = mongoose.models.User || mongoose.model("User", UserSchema);

async function seed() {
  await mongoose.connect(uri);
  console.log(`✅  Connected to ${uri}`);

  // Admin user
  if (await User.findOne({ email })) {
    console.log(`ℹ️   ${email} already exists — skipping user.`);
  } else {
    await User.create({
      name: "Administrator",
      email,
      password: await bcrypt.hash(password!, 12),
      role: "admin",
      active: true,
    });
    console.log(`✅  Admin user created: ${email}`);
  }

  // Chart of Accounts (same data as the production seed route)
  const existing = await ChartOfAccount.countDocuments();
  if (existing > 0) {
    console.log(`ℹ️   COA already has ${existing} accounts — skipping.`);
  } else {
    await ChartOfAccount.insertMany(
      COA_SEED.map((a) => ({
        ...a,
        openingDebit: 0,
        openingCredit: 0,
        isActive: true,
        isSystem: true,
      })),
      { ordered: false }
    );
    console.log(`✅  Seeded ${COA_SEED.length} chart-of-accounts entries`);
  }

  // Accounting settings singleton (defaults)
  if (!(await AccountingSettings.findOne())) {
    await AccountingSettings.create({});
    console.log("✅  Accounting settings created (defaults)");
  }

  await mongoose.disconnect();
  console.log("✅  Done");
}

seed().catch((err) => {
  console.error("❌  Seed failed:", err);
  process.exit(1);
});
