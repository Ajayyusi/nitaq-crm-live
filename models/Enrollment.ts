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
  },
  { timestamps: true },
);

EnrollmentSchema.index({ status: 1, createdAt: -1 });
EnrollmentSchema.index({ course: 1, status: 1 });

const Enrollment =
  (mongoose.models.Enrollment as mongoose.Model<IEnrollment>) ||
  mongoose.model<IEnrollment>("Enrollment", EnrollmentSchema);

export default Enrollment;
