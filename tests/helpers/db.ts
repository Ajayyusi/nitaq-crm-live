/**
 * Test database helpers: an in-memory MongoDB instance shared by one test
 * file, with the REAL production Chart of Accounts seeded so account codes
 * always match what AccountingSettings resolves to.
 */
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import ChartOfAccount from "@/models/accounting/ChartOfAccount";
import AccountingSettings, {
  type IAccountingSettings,
} from "@/models/accounting/AccountingSettings";
import { COA_SEED } from "@/lib/accounting/coa-seed";

let server: MongoMemoryServer | null = null;

export async function connectTestDb(): Promise<void> {
  server = await MongoMemoryServer.create();
  await mongoose.connect(server.getUri("nitaq-crm-test"));
}

export async function disconnectTestDb(): Promise<void> {
  await mongoose.disconnect();
  if (server) {
    await server.stop();
    server = null;
  }
}

/** Wipe every collection between tests (also resets counters/JV sequences). */
export async function resetDb(): Promise<void> {
  await Promise.all(
    Object.values(mongoose.connection.collections).map((c) => c.deleteMany({}))
  );
}

/** Seed the official Chart of Accounts exactly as production does. */
export async function seedCoa(): Promise<void> {
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
}

/**
 * Create the singleton AccountingSettings doc with overrides (defaults apply
 * for everything else). Call before code that reads getAccountingSettings().
 */
export async function configureSettings(
  over: Partial<IAccountingSettings> = {}
): Promise<IAccountingSettings> {
  await AccountingSettings.deleteMany({});
  return AccountingSettings.create(over);
}

/** Frequently used posting-account codes from the official COA. */
export const ACC = {
  cash: "1010100001", // Cash In hand
  pos: "1010100002", // RAK-POS collection
  tabby: "1010100003", // Tabby collection
  tamara: "1010100004", // Tamara collection
  pettyCash: "1010100005", // Petty Cash
  bank: "1010200001", // RAK Bank
  arParent: "10103", // ACCOUNTS RECEIVABLES (parent — not posting)
  arControl: "1010300001", // Student-1 receivables control
  apParent: "20102", // Accounts Payable (parent — not posting)
  feesAdvance: "2030100001",
  inputVat: "2030100002",
  outputVat: "2030100003",
  revenue: "4010010001", // Course 1
  revenueAlt: "4010020001", // Course 2
  expenseMisc: "5010010017", // Miscellaneous Expenses
  teacherSalary: "5010010038", // Salaries - Teaching Staff
} as const;
