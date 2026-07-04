import mongoose, { Schema, type Document, type Types } from "mongoose";

export const journalStatuses = ["Draft", "Posted", "Reversed", "Cancelled"] as const;
export type JournalStatus = (typeof journalStatuses)[number];

export const journalSourceTypes = [
  "JV",              // manual journal voucher
  "Invoice",         // student invoice (enrollment fee)
  "Receipt",         // customer/student payment received
  "Expense",         // expense paid immediately
  "SupplierBill",
  "SupplierPayment",
  "Refund",
  "Advance",         // fees received in advance
  "Opening",
  "Reversal",
] as const;
export type JournalSourceType = (typeof journalSourceTypes)[number];

export interface IJournalLine {
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
  description?: string;
  studentRef?: string;    // student / enrollment label for sub-ledger reporting
  supplierRef?: string;
  courseRef?: string;
}

export interface IJournalEntry extends Document {
  jvNumber: string;               // e.g. JV-000123
  date: Date;
  description: string;
  reference?: string;
  sourceType: JournalSourceType;
  sourceId?: string;              // CRM document id this entry was generated from
  sourceNumber?: string;          // human-readable source doc number (P-001, E-004…)
  status: JournalStatus;
  lines: IJournalLine[];
  totalDebit: number;
  totalCredit: number;
  createdBy: string;
  postedBy?: string;
  postedAt?: Date;
  reversedByEntryId?: Types.ObjectId;  // the reversal JV
  reversesEntryId?: Types.ObjectId;    // set on the reversal itself
  createdAt: Date;
  updatedAt: Date;
}

const JournalLineSchema = new Schema<IJournalLine>(
  {
    accountCode: { type: String, required: true, trim: true },
    accountName: { type: String, required: true, trim: true },
    debit:       { type: Number, default: 0, min: 0 },
    credit:      { type: Number, default: 0, min: 0 },
    description: { type: String, trim: true, maxlength: 500 },
    studentRef:  { type: String, trim: true },
    supplierRef: { type: String, trim: true },
    courseRef:   { type: String, trim: true },
  },
  { _id: false }
);

const JournalEntrySchema = new Schema<IJournalEntry>(
  {
    jvNumber:     { type: String, required: true, unique: true },
    date:         { type: Date, required: true },
    description:  { type: String, required: true, trim: true, maxlength: 500 },
    reference:    { type: String, trim: true, maxlength: 200 },
    sourceType:   { type: String, enum: journalSourceTypes, required: true },
    sourceId:     { type: String, trim: true },
    sourceNumber: { type: String, trim: true },
    status:       { type: String, enum: journalStatuses, default: "Draft" },
    lines:        { type: [JournalLineSchema], required: true },
    totalDebit:   { type: Number, required: true, min: 0 },
    totalCredit:  { type: Number, required: true, min: 0 },
    createdBy:    { type: String, required: true, trim: true },
    postedBy:     { type: String, trim: true },
    postedAt:     Date,
    reversedByEntryId: { type: Schema.Types.ObjectId, ref: "JournalEntry" },
    reversesEntryId:   { type: Schema.Types.ObjectId, ref: "JournalEntry" },
  },
  { timestamps: true }
);

JournalEntrySchema.index({ date: -1, status: 1 });
JournalEntrySchema.index({ "lines.accountCode": 1, date: 1 });
// One ACTIVE journal entry per CRM source document is enforced in the engine
// (Reversed/Cancelled entries may share a sourceId with their repost, so this
// index is intentionally NOT unique).
JournalEntrySchema.index({ sourceType: 1, sourceId: 1 });

export default (mongoose.models.JournalEntry as mongoose.Model<IJournalEntry>) ||
  mongoose.model<IJournalEntry>("JournalEntry", JournalEntrySchema);
