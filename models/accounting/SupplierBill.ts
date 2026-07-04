import mongoose, { Schema, type Document, type Types } from "mongoose";

export const billStatuses = ["Unpaid", "Partially Paid", "Paid", "Cancelled"] as const;
export type BillStatus = (typeof billStatuses)[number];

export interface ISupplierBill extends Document {
  billNumber: string;          // auto: SB-0001
  supplierId: Types.ObjectId;
  supplierName: string;
  billDate: Date;
  dueDate?: Date;
  reference?: string;          // supplier's invoice number
  expenseAccountCode: string;
  description?: string;
  amountBeforeVAT: number;
  vatRate: number;             // 0 or 5
  vatAmount: number;
  totalAmount: number;
  amountPaid: number;
  status: BillStatus;
  journalEntryId?: Types.ObjectId;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const SupplierBillSchema = new Schema<ISupplierBill>(
  {
    billNumber:   { type: String, required: true, unique: true },
    supplierId:   { type: Schema.Types.ObjectId, ref: "Supplier", required: true },
    supplierName: { type: String, required: true, trim: true },
    billDate:     { type: Date, required: true },
    dueDate:      Date,
    reference:    { type: String, trim: true, maxlength: 100 },
    expenseAccountCode: { type: String, required: true, trim: true },
    description:  { type: String, trim: true, maxlength: 500 },
    amountBeforeVAT: { type: Number, required: true, min: 0 },
    vatRate:      { type: Number, default: 0, min: 0 },
    vatAmount:    { type: Number, default: 0, min: 0 },
    totalAmount:  { type: Number, required: true, min: 0 },
    amountPaid:   { type: Number, default: 0, min: 0 },
    status:       { type: String, enum: billStatuses, default: "Unpaid" },
    journalEntryId: { type: Schema.Types.ObjectId, ref: "JournalEntry" },
    createdBy:    { type: String, required: true },
  },
  { timestamps: true }
);

SupplierBillSchema.index({ supplierId: 1, status: 1 });
SupplierBillSchema.index({ billDate: -1 });

export default (mongoose.models.SupplierBill as mongoose.Model<ISupplierBill>) ||
  mongoose.model<ISupplierBill>("SupplierBill", SupplierBillSchema);
