import mongoose, { Document, Schema } from "mongoose";

export const enrollmentStatuses = ["Active", "Completed", "Dropped", "On Hold"] as const;
export const paymentStatuses = [
  "Paid Full",
  "Instalment 1 Paid",
  "Instalment 2 Pending",
  "Overdue",
  "Free",
] as const;
export const scheduleFormats = ["In-Person", "Online", "Hybrid"] as const;
/**
 * How the trainer is paid for THIS registration. Pay belongs to the
 * registration, not the trainer, because the same trainer can earn a
 * different rate on different courses. Left empty, the trainer's own
 * default rate applies (see lib/payroll.ts).
 */
export const teacherPayBases = ["Per Hour", "Per Class", "Fixed for Course"] as const;
export type TeacherPayBasis = (typeof teacherPayBases)[number];

export type EnrollmentStatus = (typeof enrollmentStatuses)[number];
export type PaymentStatus = (typeof paymentStatuses)[number];
export type ScheduleFormat = (typeof scheduleFormats)[number];

export interface IEnrollment extends Document {
  enrollmentId: string;
  leadId?: mongoose.Types.ObjectId;
  fullName: string;
  phone: string;
  email?: string;
  emiratesId?: string;
  nationality?: string;
  course: string;
  batchName?: string;
  startDate?: Date;
  endDate?: Date;
  schedule?: string;
  format: ScheduleFormat;
  status: EnrollmentStatus;
  paymentStatus: PaymentStatus;
  totalFee: number;
  amountPaid: number;
  notes?: string;
  registrationDate: Date;
  arAccountCode?: string;   // this student's ledger account under Accounts Receivable
  // ── Teacher assignment & hour tracking (per course registration) ──
  /**
   * Primary trainer. Always mirrors teacherIds[0] — kept as a scalar so
   * payroll, class sessions and every existing query keep working.
   */
  teacherId?: mongoose.Types.ObjectId;
  teacherName?: string;                 // denormalized for display
  /** All trainers on this registration; a student may be taught by several. */
  teacherIds?: mongoose.Types.ObjectId[];
  teacherNames?: string[];              // denormalized, index-aligned with teacherIds
  /** Trainer pay for this registration; falls back to the trainer's default when unset. */
  teacherPayRate?: number;
  teacherPayBasis?: TeacherPayBasis;
  totalRegisteredHours?: number;
  completedHours?: number;              // recalculated from ClassSession records — never edited directly
  expectedCompletionDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const EnrollmentSchema = new Schema<IEnrollment>(
  {
    enrollmentId: { type: String, unique: true, index: true },
    leadId: { type: Schema.Types.ObjectId, ref: "Lead" },
    fullName: { type: String, required: true, trim: true, maxlength: 120 },
    phone: { type: String, required: true, trim: true, maxlength: 30 },
    email: { type: String, lowercase: true, trim: true },
    emiratesId: { type: String, trim: true },
    nationality: { type: String, trim: true, maxlength: 80 },
    course: { type: String, required: true, trim: true },
    batchName: { type: String, trim: true },
    startDate: Date,
    endDate: Date,
    schedule: { type: String, trim: true },
    format: { type: String, enum: [...scheduleFormats], default: "In-Person" },
    status: { type: String, enum: [...enrollmentStatuses], required: true, default: "Active" },
    paymentStatus: { type: String, enum: [...paymentStatuses], required: true, default: "Instalment 1 Paid" },
    totalFee: { type: Number, required: true, min: 0, default: 0 },
    amountPaid: { type: Number, required: true, min: 0, default: 0 },
    notes: { type: String, trim: true, maxlength: 2000 },
    registrationDate: { type: Date, default: Date.now },
    arAccountCode: { type: String, trim: true },
    teacherId: { type: Schema.Types.ObjectId, ref: "Teacher" },
    teacherName: { type: String, trim: true },
    teacherIds: [{ type: Schema.Types.ObjectId, ref: "Teacher" }],
    teacherNames: [{ type: String, trim: true }],
    teacherPayRate: { type: Number, min: 0 },
    teacherPayBasis: { type: String, enum: [...teacherPayBases] },
    totalRegisteredHours: { type: Number, min: 0 },
    completedHours: { type: Number, min: 0, default: 0 },
    expectedCompletionDate: Date,
  },
  { timestamps: true },
);

EnrollmentSchema.index({ status: 1, createdAt: -1 });
EnrollmentSchema.index({ course: 1, status: 1 });
EnrollmentSchema.index({ registrationDate: -1 });

const Enrollment =
  (mongoose.models.Enrollment as mongoose.Model<IEnrollment>) ||
  mongoose.model<IEnrollment>("Enrollment", EnrollmentSchema);

export default Enrollment;
