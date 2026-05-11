/**
 * Seed script — creates the first Super Admin user
 * Run: npx tsx scripts/seed.ts
 *
 * Set MONGODB_URI in .env.local before running.
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

  const email = "admin@nitaq.com";
  const existing = await User.findOne({ email });

  if (existing) {
    console.log(`ℹ️   User ${email} already exists. Skipping.`);
    await mongoose.disconnect();
    return;
  }

  const hashed = await bcrypt.hash("Nitaq@2024!", 12);
  await User.create({
    name: "Super Admin",
    email,
    password: hashed,
    role: "super_admin",
    active: true,
    phone: "+971500000000",
  });

  console.log("✅  Super Admin created:");
  console.log("   Email:    admin@nitaq.com");
  console.log("   Password: Nitaq@2024!");
  console.log("   ⚠️  Change the password immediately after first login.");

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error("❌  Seed failed:", err);
  process.exit(1);
});
