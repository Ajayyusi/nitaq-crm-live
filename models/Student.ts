import mongoose, { Schema, Document } from "mongoose";

export interface IStudent extends Document {
  fullName: string;
  phone: string;
  parentPhone?: string;
  email?: string;
  dateOfBirth?: Date;
  school?: string;
  grade?: string;
  notes?: string;
  active: boolean;
  leadId?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const StudentSchema = new Schema<IStudent>(
  {
    fullName: { type: String, required: true, trim: true },
    phone: { type: String, required: true },
    parentPhone: String,
    email: { type: String, lowercase: true },
    dateOfBirth: Date,
    school: String,
    grade: String,
    notes: String,
    active: { type: Boolean, default: true },
    leadId: { type: Schema.Types.ObjectId, ref: "Lead" },
  },
  { timestamps: true }
);

export default mongoose.models.Student || mongoose.model<IStudent>("Student", StudentSchema);
