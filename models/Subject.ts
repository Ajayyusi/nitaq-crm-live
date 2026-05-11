import mongoose, { Schema, Document } from "mongoose";

export interface ISubject extends Document {
  courseId: mongoose.Types.ObjectId;
  name: string;
  level?: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const SubjectSchema = new Schema<ISubject>(
  {
    courseId: { type: Schema.Types.ObjectId, ref: "Course", required: true },
    name: { type: String, required: true, trim: true },
    level: String,
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.models.Subject || mongoose.model<ISubject>("Subject", SubjectSchema);
