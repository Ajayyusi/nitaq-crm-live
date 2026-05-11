import mongoose, { Schema, Document } from "mongoose";

// Payment
export interface IPayment extends Document {
  studentId: mongoose.Types.ObjectId;
  enrollmentId: mongoose.Types.ObjectId;
  amount: number;
  paymentMethod: string;
  paymentDate: Date;
  notes?: string;
  receiptUrl?: string;
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentSchema = new Schema<IPayment>(
  {
    studentId: { type: Schema.Types.ObjectId, ref: "Student", required: true },
    enrollmentId: { type: Schema.Types.ObjectId, ref: "Enrollment", required: true },
    amount: { type: Number, required: true },
    paymentMethod: {
      type: String,
      enum: ["cash", "bank_transfer", "card", "cheque", "online"],
      required: true,
    },
    paymentDate: { type: Date, default: Date.now },
    notes: String,
    receiptUrl: String,
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

export const Payment = mongoose.models.Payment || mongoose.model<IPayment>("Payment", PaymentSchema);

// Expense
export interface IExpense extends Document {
  category: string;
  amount: number;
  expenseDate: Date;
  payee?: string;
  description?: string;
  branchId?: string;
  receiptUrl?: string;
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ExpenseSchema = new Schema<IExpense>(
  {
    category: {
      type: String,
      enum: ["rent", "salaries", "utilities", "marketing", "supplies", "maintenance", "other"],
      required: true,
    },
    amount: { type: Number, required: true },
    expenseDate: { type: Date, default: Date.now },
    payee: String,
    description: String,
    branchId: String,
    receiptUrl: String,
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

export const Expense = mongoose.models.Expense || mongoose.model<IExpense>("Expense", ExpenseSchema);
