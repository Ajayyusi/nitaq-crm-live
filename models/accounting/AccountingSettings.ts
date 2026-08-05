import mongoose, { Schema, type Document } from "mongoose";

/**
 * Singleton document mapping CRM concepts to Chart of Accounts codes.
 * NOTHING in the accounting engine is hardcoded to an account —
 * every posting resolves its accounts through these settings.
 */
export interface IAccountingSettings extends Document {
  // Money accounts
  defaultCashAccount: string;
  defaultBankAccount: string;
  defaultPosAccount: string;
  tabbyAccount: string;
  tamaraAccount: string;
  pettyCashAccount: string;
  // Control accounts
  accountsReceivable: string;
  accountsPayable: string;       // parent code — supplier lines use supplier account codes
  feesAdvanceAccount: string;
  outputVatAccount: string;
  inputVatAccount: string;
  // P&L
  defaultRevenueAccount: string;
  defaultExpenseAccount: string;
  teacherSalaryAccount: string;   // where teacher payouts are expensed
  discountAccount: string;
  refundAccount: string;
  badDebtAccount: string;
  // Revenue mapping per course category (category label -> revenue account code)
  courseRevenueMap: Record<string, string>;
  // VAT behaviour
  vatEnabled: boolean;
  vatRate: number;
  // Auto-posting toggles
  autoPostPayments: boolean;
  autoPostExpenses: boolean;
  autoPostInvoices: boolean;
  // Books lock: no journal entries can be posted on or before this date
  lockDate?: Date | null;
  updatedAt: Date;
}

const AccountingSettingsSchema = new Schema<IAccountingSettings>(
  {
    defaultCashAccount:  { type: String, default: "1010100001" }, // Cash In hand
    defaultBankAccount:  { type: String, default: "1010200001" }, // RAK Bank
    defaultPosAccount:   { type: String, default: "1010100002" }, // RAK-POS collection
    tabbyAccount:        { type: String, default: "1010100003" },
    tamaraAccount:       { type: String, default: "1010100004" },
    pettyCashAccount:    { type: String, default: "1010100005" },
    accountsReceivable:  { type: String, default: "1010300001" }, // Student receivables control
    accountsPayable:     { type: String, default: "20102" },
    feesAdvanceAccount:  { type: String, default: "2030100001" },
    outputVatAccount:    { type: String, default: "2030100003" },
    inputVatAccount:     { type: String, default: "2030100002" },
    defaultRevenueAccount: { type: String, default: "4010010001" },
    defaultExpenseAccount: { type: String, default: "5010010017" }, // Miscellaneous Expenses
    teacherSalaryAccount:  { type: String, default: "5010010038" }, // Salaries - Teaching Staff
    discountAccount:     { type: String, default: "" },
    refundAccount:       { type: String, default: "" },
    badDebtAccount:      { type: String, default: "" },
    courseRevenueMap:    { type: Map, of: String, default: {} },
    vatEnabled:          { type: Boolean, default: false },
    vatRate:             { type: Number, default: 5 },
    autoPostPayments:    { type: Boolean, default: true },
    autoPostExpenses:    { type: Boolean, default: true },
    autoPostInvoices:    { type: Boolean, default: true },
    lockDate:            { type: Date, default: null },
  },
  { timestamps: true }
);

const AccountingSettings =
  (mongoose.models.AccountingSettings as mongoose.Model<IAccountingSettings>) ||
  mongoose.model<IAccountingSettings>("AccountingSettings", AccountingSettingsSchema);

export async function getAccountingSettings(): Promise<IAccountingSettings> {
  const existing = await AccountingSettings.findOne();
  if (existing) return existing;
  return AccountingSettings.create({});
}

export default AccountingSettings;
