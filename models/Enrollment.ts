import mongoose, { Schema, Document } from "mongoose";

export interface IEnrollment extends Document {
  leadId?: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  teacherId: mongoose.Types.ObjectId;
  courseId: mongoose.Types.ObjectId;
  subjectId?: mongoose.Types.ObjectId;
  packageName?: string;
  sessionsCount: number;
  sessionDuration: number; // minutes
  totalPrice: number;
  discount: number;
  finalPrice: number;
  teacherCost: number;
  paymentPlan: string;
  startDate?: Date;
  endDate?: Date;
  status: string;
  notes?: string;
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const EnrollmentSchema = new Schema<IEnrollment>(
  {
    leadId: { type: Schema.Types.ObjectId, ref: "Lead" },
    studentId: { type: Schema.Types.ObjectId, ref: "Student", required: true },
    teacherId: { type: Schema.Types.ObjectId, ref: "Teacher", required: true },
    courseId: { type: Schema.Types.ObjectId, ref: "Course", required: true },
    subjectId: { type: Schema.Types.ObjectId, ref: "Subject" },
    packageName: String,
    sessionsCount: { type: Number, required: true },
    sessionDuration: { type: Number, default: 60 },
    totalPrice: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    finalPrice: { type: Number, required: true },
    teacherCost: { type: Number, default: 0 },
    paymentPlan: {
      type: String,
      enum: ["full", "installments", "monthly"],
      default: "full",
    },
    startDate: Date,
    endDate: Date,
    status: {
      type: String,
      enum: ["active", "completed", "paused", "cancelled"],
      default: "active",
    },
    notes: String,
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

EnrollmentSchema.index({ studentId: 1, status: 1 });
EnrollmentSchema.index({ teacherId: 1 });

export default mongoose.models.Enrollment ||
  mongoose.model<IEnrollment>("Enrollment", EnrollmentSchema);
