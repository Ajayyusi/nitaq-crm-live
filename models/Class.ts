import mongoose, { Schema, Document } from "mongoose";

export interface IClass extends Document {
  enrollmentId: mongoose.Types.ObjectId;
  teacherId: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  subjectId?: mongoose.Types.ObjectId;
  classDate: Date;
  startTime: string;
  endTime: string;
  mode: string;
  roomOrLink?: string;
  status: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ClassSchema = new Schema<IClass>(
  {
    enrollmentId: { type: Schema.Types.ObjectId, ref: "Enrollment", required: true },
    teacherId: { type: Schema.Types.ObjectId, ref: "Teacher", required: true },
    studentId: { type: Schema.Types.ObjectId, ref: "Student", required: true },
    subjectId: { type: Schema.Types.ObjectId, ref: "Subject" },
    classDate: { type: Date, required: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    mode: { type: String, enum: ["online", "offline"], default: "offline" },
    roomOrLink: String,
    status: {
      type: String,
      enum: ["scheduled", "completed", "cancelled", "rescheduled", "no_show"],
      default: "scheduled",
    },
    notes: String,
  },
  { timestamps: true }
);

ClassSchema.index({ teacherId: 1, classDate: 1 });
ClassSchema.index({ studentId: 1, classDate: 1 });

export default mongoose.models.Class || mongoose.model<IClass>("Class", ClassSchema);
