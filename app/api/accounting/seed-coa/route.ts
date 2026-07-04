import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import ChartOfAccount from "@/models/accounting/ChartOfAccount";
import Supplier from "@/models/accounting/Supplier";
import { getAccountingSettings } from "@/models/accounting/AccountingSettings";
import { COA_SEED } from "@/lib/accounting/coa-seed";
import { requireAuth } from "@/lib/api-auth";
import { logAudit } from "@/lib/audit";

/**
 * Seeds the Chart of Accounts from the accountant's Excel file.
 * Idempotent: upserts by account code, never overwrites opening balances
 * or names that were edited after the initial seed.
 */
export async function POST() {
  const authed = await requireAuth(["admin", "accountant"]);
  if (authed instanceof NextResponse) return authed;

  await connectDB();

  let created = 0;
  let existing = 0;
  for (const a of COA_SEED) {
    const found = await ChartOfAccount.findOne({ code: a.code }).lean();
    if (found) { existing++; continue; }
    await ChartOfAccount.create({
      code: a.code,
      name: a.name,
      type: a.type,
      category: a.category,
      subCategory: a.subCategory ?? undefined,
      mainAccount: a.mainAccount ?? undefined,
      parentCode: a.parentCode,
      isPosting: a.isPosting,
      isSystem: true,
    });
    created++;
  }

  // Seed the three suppliers that exist in the COA (SP001-003)
  let suppliersCreated = 0;
  const seedSuppliers = [
    { supplierCode: "SP001", name: "Etisalat" },
    { supplierCode: "SP002", name: "DEWA" },
    { supplierCode: "SP003", name: "Abu Khamseen Towers" },
  ];
  for (const s of seedSuppliers) {
    const found = await Supplier.findOne({ supplierCode: s.supplierCode }).lean();
    if (!found) {
      await Supplier.create({ ...s, vatRegistered: true });
      suppliersCreated++;
    }
  }

  // Ensure the settings singleton exists with sensible defaults
  await getAccountingSettings();

  logAudit({
    userName: authed.name, userRole: authed.role,
    action: "created", entity: "ChartOfAccount", entityId: "seed",
    entityLabel: "COA Seed", detail: `${created} accounts created, ${existing} already existed`,
  });

  return NextResponse.json({
    message: `Chart of Accounts seeded: ${created} created, ${existing} already existed, ${suppliersCreated} suppliers created.`,
  });
}
