import mongoose, { Schema, Document } from "mongoose";

export const paymentMethods = [
  "Bank Transfer",
  "Cash",
  "Card",
  "Cheque",
  "Online",
] as const;

export const paymentTypes = [
  "Full Payment",
  "Instalment 1 of 2",
  "Instalment 2 of 2",
  "Deposit",
  "Refund",
] as const;

export const txStatuses = ["Received", "Pending", "Overdue", "Refunded"] as const;

export const expenseCategories = [
  "Rent",
  "Salaries",
  "Utilities",
  "Marketing",
  "Supplies",
  "Maintenance",
  "Other",
] as const;

export type PaymentMethod = (typeof paymentMethods)[number];
export type TxPaymentType = (typeof paymentTypes)[number];
export type TxStatus = (typeof txStatuses)[number];
export type ExpenseCategory = (typeof expenseCategories)[number];

// Payment
export interface IPayment extends Document {
  paymentId: string;
  enrollmentId?: mongoose.Types.ObjectId;
  studentName: string;
  studentPhone?: string;
  course?: string;
  amount: number;
  paymentType: TxPaymentType;
  paymentMethod: PaymentMethod;
  status: TxStatus;
  datePaid?: Date;
  dueDate?: Date;
  receiptRef?: string;
  notes?: string;
  recordedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentSchema = new Schema<IPayment>(
  {
    paymentId: { type: String, unique: true, index: true },
    enrollmentId: { type: Schema.Types.ObjectId, ref: "Enrollment" },
    studentName: { type: String, required: true, trim: true },
    studentPhone: { type: String, trim: true },
    course: { type: String, trim: true },
    amount: { type: Number, required: true, min: 0 },
    paymentType: {
      type: String,
      enum: [...paymentTypes],
      required: true,
      default: "Full Payment",
    },
    paymentMethod: {
      type: String,
      enum: [...paymentMethods],
      required: true,
      default: "Cash",
    },
    status: {
      type: String,
      enum: [...txStatuses],
      required: true,
      default: "Received",
    },
    datePaid: Date,
    dueDate: Date,
    receiptRef: { type: String, trim: true },
    notes: { type: String, trim: true, maxlength: 1000 },
    recordedBy: { type: String, trim: true },
  },
  { timestamps: true },
);

PaymentSchema.index({ status: 1, datePaid: -1 });

export const Payment =
  (mongoose.models.Payment as mongoose.Model<IPayment>) ||
  mongoose.model<IPayment>("Payment", PaymentSchema);

// Expense
export interface IExpense extends Document {
  expenseId: string;
  category: ExpenseCategory;
  amount: number;
  expenseDate: Date;
  payee?: string;
  description?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ExpenseSchema = new Schema<IExpense>(
  {
    expenseId: { type: String, unique: true, index: true },
    category: { type: String, enum: [...expenseCategories], required: true },
    amount: { type: Number, required: true, min: 0 },
    expenseDate: { type: Date, default: Date.now },
    payee: { type: String, trim: true },
    description: { type: String, trim: true, maxlength: 500 },
    notes: { type: String, trim: true, maxlength: 1000 },
  },
  { timestamps: true },
);

export const Expense =
  (mongoose.models.Expense as mongoose.Model<IExpense>) ||
  mongoose.model<IExpense>("Expense", ExpenseSchema);

export default Payment;
