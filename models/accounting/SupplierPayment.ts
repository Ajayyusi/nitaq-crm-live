import mongoose, { Schema, type Document, type Types } from "mongoose";

export interface ISupplierPayment extends Document {
  paymentNumber: string;      // auto: SPY-0001
  supplierId: Types.ObjectId;
  supplierName: string;
  billId?: Types.ObjectId;    // optional link to a specific bill
  paymentDate: Date;
  amount: number;
  paymentAccountCode: string; // bank / cash / petty cash account paid from
  reference?: string;
  notes?: string;
  journalEntryId?: Types.ObjectId;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const SupplierPaymentSchema = new Schema<ISupplierPayment>(
  {
    paymentNumber: { type: String, required: true, unique: true },
    supplierId:    { type: Schema.Types.ObjectId, ref: "Supplier", required: true },
    supplierName:  { type: String, required: true, trim: true },
    billId:        { type: Schema.Types.ObjectId, ref: "SupplierBill" },
    paymentDate:   { type: Date, required: true },
    amount:        { type: Number, required: true, min: 0.01 },
    paymentAccountCode: { type: String, required: true, trim: true },
    reference:     { type: String, trim: true, maxlength: 100 },
    notes:         { type: String, trim: true, maxlength: 500 },
    journalEntryId: { type: Schema.Types.ObjectId, ref: "JournalEntry" },
    createdBy:     { type: String, required: true },
  },
  { timestamps: true }
);

SupplierPaymentSchema.index({ supplierId: 1, paymentDate: -1 });

export default (mongoose.models.SupplierPayment as mongoose.Model<ISupplierPayment>) ||
  mongoose.model<ISupplierPayment>("SupplierPayment", SupplierPaymentSchema);
