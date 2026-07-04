import mongoose, { Schema, type Document } from "mongoose";

export const accountTypes = ["Asset", "Liability", "Equity", "Revenue", "Expense"] as const;
export type AccountType = (typeof accountTypes)[number];

export interface IChartOfAccount extends Document {
  code: string;              // unique account code from the COA (e.g. "1010100001", "SP001")
  name: string;
  type: AccountType;
  category: string;          // top-level group label (ASSETS, LIABILITIES, …)
  subCategory?: string;
  mainAccount?: string;      // e.g. "CASH", "BANKS", "Accounts Payable"
  parentCode?: string | null;
  isPosting: boolean;        // only posting accounts can carry transactions
  openingDebit: number;
  openingCredit: number;
  isActive: boolean;
  isSystem: boolean;         // seeded from the official COA — cannot be deleted
  createdAt: Date;
  updatedAt: Date;
}

const ChartOfAccountSchema = new Schema<IChartOfAccount>(
  {
    code:          { type: String, required: true, unique: true, trim: true, maxlength: 30 },
    name:          { type: String, required: true, trim: true, maxlength: 200 },
    type:          { type: String, enum: accountTypes, required: true },
    category:      { type: String, trim: true, default: "" },
    subCategory:   { type: String, trim: true },
    mainAccount:   { type: String, trim: true },
    parentCode:    { type: String, trim: true, default: null },
    isPosting:     { type: Boolean, default: true },
    openingDebit:  { type: Number, default: 0, min: 0 },
    openingCredit: { type: Number, default: 0, min: 0 },
    isActive:      { type: Boolean, default: true },
    isSystem:      { type: Boolean, default: false },
  },
  { timestamps: true }
);

ChartOfAccountSchema.index({ type: 1, isPosting: 1 });
ChartOfAccountSchema.index({ parentCode: 1 });
ChartOfAccountSchema.index({ name: "text" });

export default (mongoose.models.ChartOfAccount as mongoose.Model<IChartOfAccount>) ||
  mongoose.model<IChartOfAccount>("ChartOfAccount", ChartOfAccountSchema);
