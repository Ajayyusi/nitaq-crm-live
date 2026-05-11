import mongoose, { Schema, Document } from "mongoose";

export interface ITeacherSubject extends Document {
  teacherId: mongoose.Types.ObjectId;
  courseId: mongoose.Types.ObjectId;
  subjectId: mongoose.Types.ObjectId;
  level?: string;
  onlineAvailable: boolean;
  offlineAvailable: boolean;
  onlineRate: number;
  offlineRate: number;
  dailyRate?: number;
  paymentType: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const TeacherSubjectSchema = new Schema<ITeacherSubject>(
  {
    teacherId: { type: Schema.Types.ObjectId, ref: "Teacher", required: true },
    courseId: { type: Schema.Types.ObjectId, ref: "Course", required: true },
    subjectId: { type: Schema.Types.ObjectId, ref: "Subject", required: true },
    level: String,
    onlineAvailable: { type: Boolean, default: true },
    offlineAvailable: { type: Boolean, default: true },
    onlineRate: { type: Number, default: 0 },
    offlineRate: { type: Number, default: 0 },
    dailyRate: Number,
    paymentType: {
      type: String,
      enum: ["per_hour", "per_session", "per_day", "monthly"],
      default: "per_hour",
    },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

TeacherSubjectSchema.index({ teacherId: 1, subjectId: 1 });

export default mongoose.models.TeacherSubject ||
  mongoose.model<ITeacherSubject>("TeacherSubject", TeacherSubjectSchema);
