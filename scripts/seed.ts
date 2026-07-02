/**
 * Seed script — creates the first admin user.
 * Run: SEED_ADMIN_EMAIL=you@example.com SEED_ADMIN_PASSWORD='strong-password' npx tsx scripts/seed.ts
 *
 * Set MONGODB_URI in .env.local before running.
 * Credentials are taken from environment variables only — never hardcode them.
 */

import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error("❌  MONGODB_URI not set in .env.local");
  process.exit(1);
}

const email = process.env.SEED_ADMIN_EMAIL?.toLowerCase().trim();
const password = process.env.SEED_ADMIN_PASSWORD;
const name = process.env.SEED_ADMIN_NAME || "Administrator";

if (!email || !password) {
  console.error("❌  Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD environment variables.");
  process.exit(1);
}
if (password.length < 12) {
  console.error("❌  SEED_ADMIN_PASSWORD must be at least 12 characters.");
  process.exit(1);
}

const UserSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true, lowercase: true },
  password: String,
  role: String,
  active: { type: Boolean, default: true },
  phone: String,
}, { timestamps: true });

const User = mongoose.models.User || mongoose.model("User", UserSchema);

async function seed() {
  await mongoose.connect(MONGODB_URI!);
  console.log("✅  Connected to MongoDB");

  const existing = await User.findOne({ email });
  if (existing) {
    console.log(`ℹ️   User ${email} already exists. Skipping.`);
    await mongoose.disconnect();
    return;
  }

  const hashed = await bcrypt.hash(password!, 12);
  await User.create({ name, email, password: hashed, role: "admin", active: true });

  console.log(`✅  Admin user created: ${email}`);
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error("❌  Seed failed:", err);
  process.exit(1);
});
