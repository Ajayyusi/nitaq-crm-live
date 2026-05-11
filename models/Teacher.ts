import mongoose, { Schema, Document } from "mongoose";

export interface ITeacher extends Document {
  fullName: string;
  phone: string;
  whatsapp?: string;
  email?: string;
  jobTitle?: string;
  status: string;
  employmentType: string;
  notes?: string;
  branchPreference?: string;
  active: boolean;
  userId?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const TeacherSchema = new Schema<ITeacher>(
  {
    fullName: { type: String, required: true, trim: true },
    phone: { type: String, required: true },
    whatsapp: String,
    email: { type: String, lowercase: true },
    jobTitle: String,
    status: {
      type: String,
      enum: ["active", "inactive", "on_leave"],
      default: "active",
    },
    employmentType: {
      type: String,
      enum: ["full_time", "part_time", "freelance", "contract"],
      default: "part_time",
    },
    notes: String,
    branchPreference: String,
    active: { type: Boolean, default: true },
    userId: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

export default mongoose.models.Teacher || mongoose.model<ITeacher>("Teacher", TeacherSchema);
