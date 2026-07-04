import mongoose, { Schema, type Document } from "mongoose";

export interface ISupplier extends Document {
  supplierCode: string;      // e.g. SP001 — also the supplier's ledger account code under Accounts Payable
  name: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  trn?: string;              // UAE Tax Registration Number
  address?: string;
  vatRegistered: boolean;
  defaultExpenseAccountCode?: string;
  openingBalance: number;    // positive = we owe them
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const SupplierSchema = new Schema<ISupplier>(
  {
    supplierCode:  { type: String, required: true, unique: true, trim: true, maxlength: 20 },
    name:          { type: String, required: true, trim: true, maxlength: 200 },
    contactPerson: { type: String, trim: true, maxlength: 120 },
    phone:         { type: String, trim: true, maxlength: 30 },
    email:         { type: String, trim: true, lowercase: true },
    trn:           { type: String, trim: true, maxlength: 30 },
    address:       { type: String, trim: true, maxlength: 500 },
    vatRegistered: { type: Boolean, default: false },
    defaultExpenseAccountCode: { type: String, trim: true },
    openingBalance: { type: Number, default: 0 },
    isActive:      { type: Boolean, default: true },
  },
  { timestamps: true }
);

SupplierSchema.index({ name: "text" });

export default (mongoose.models.Supplier as mongoose.Model<ISupplier>) ||
  mongoose.model<ISupplier>("Supplier", SupplierSchema);
