import mongoose, { Schema, Document } from "mongoose";

/**
 * One settlement to a teacher, covering a batch of class sessions.
 * Teachers are paid ad-hoc ("every couple of classes"), so this is not a
 * monthly payslip — it snapshots whatever was unpaid at the moment the
 * admin pressed Mark Paid, and posts the expense to the ledger.
 */
export interface ITeacherPayout extends Document {
  payoutNumber: string;                 // TP-0001
  teacherId: mongoose.Types.ObjectId;
  teacherName: string;
  sessionIds: mongoose.Types.ObjectId[];
  periodFrom?: Date;
  periodTo?: Date;
  basis: string;                        // Per Hour | Per Class | Fixed for Course | Monthly | Mixed
  rate: number;
  quantity: number;                     // hours, classes or courses covered
  /** Per-registration breakdown, snapshotted at payment time. */
  lines?: {
    enrollmentRef: string;
    studentName: string;
    course: string;
    basis: string;
    rate: number;
    quantity: number;
    sessionCount: number;
    hours: number;
    amount: number;
    source: string;
  }[];
  sessionCount: number;
  totalHours: number;
  suggestedAmount: number;              // what the system calculated
  amount: number;                       // what was actually paid (admin may adjust)
  adjustmentReason?: string;            // required when amount ≠ suggestedAmount
  paidDate: Date;
  expenseAccountCode: string;
  paymentAccountCode: string;
  journalEntryId?: mongoose.Types.ObjectId;
  notes?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const TeacherPayoutSchema = new Schema<ITeacherPayout>(
  {
    payoutNumber: { type: String, required: true, unique: true },
    teacherId:    { type: Schema.Types.ObjectId, ref: "Teacher", required: true },
    teacherName:  { type: String, required: true, trim: true },
    sessionIds:   [{ type: Schema.Types.ObjectId, ref: "ClassSession" }],
    periodFrom:   Date,
    periodTo:     Date,
    basis:        { type: String, required: true, trim: true },
    rate:         { type: Number, default: 0, min: 0 },
    quantity:     { type: Number, default: 0, min: 0 },
    lines: {
      type: [
        new Schema(
          {
            enrollmentRef: { type: String, trim: true },
            studentName:   { type: String, trim: true },
            course:        { type: String, trim: true },
            basis:         { type: String, trim: true },
            rate:          { type: Number, default: 0 },
            quantity:      { type: Number, default: 0 },
            sessionCount:  { type: Number, default: 0 },
            hours:         { type: Number, default: 0 },
            amount:        { type: Number, default: 0 },
            source:        { type: String, trim: true },
          },
          { _id: false }
        ),
      ],
      default: undefined,
    },
    sessionCount: { type: Number, default: 0, min: 0 },
    totalHours:   { type: Number, default: 0, min: 0 },
    suggestedAmount: { type: Number, default: 0, min: 0 },
    amount:       { type: Number, required: true, min: 0 },
    adjustmentReason: { type: String, trim: true, maxlength: 500 },
    paidDate:     { type: Date, required: true },
    expenseAccountCode: { type: String, required: true, trim: true },
    paymentAccountCode: { type: String, required: true, trim: true },
    journalEntryId: { type: Schema.Types.ObjectId, ref: "JournalEntry" },
    notes:        { type: String, trim: true, maxlength: 1000 },
    createdBy:    { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

TeacherPayoutSchema.index({ teacherId: 1, paidDate: -1 });

export default (mongoose.models.TeacherPayout as mongoose.Model<ITeacherPayout>) ||
  mongoose.model<ITeacherPayout>("TeacherPayout", TeacherPayoutSchema);
