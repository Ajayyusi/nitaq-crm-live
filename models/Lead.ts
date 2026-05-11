import mongoose, { Schema, Document } from "mongoose";

export interface ILead extends Document {
  studentName: string;
  studentPhone: string;
  parentPhone?: string;
  email?: string;
  courseId?: mongoose.Types.ObjectId;
  subjectId?: mongoose.Types.ObjectId;
  mode?: string;
  preferredTime?: string;
  preferredBranch?: string;
  leadSource: string;
  status: string;
  notes?: string;
  assignedSalesUser?: mongoose.Types.ObjectId;
  followUpDate?: Date;
  convertedToStudentId?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const LeadSchema = new Schema<ILead>(
  {
    studentName: { type: String, required: true, trim: true },
    studentPhone: { type: String, required: true },
    parentPhone: String,
    email: { type: String, lowercase: true },
    courseId: { type: Schema.Types.ObjectId, ref: "Course" },
    subjectId: { type: Schema.Types.ObjectId, ref: "Subject" },
    mode: { type: String, enum: ["online", "offline", "hybrid"] },
    preferredTime: String,
    preferredBranch: String,
    leadSource: {
      type: String,
      enum: ["walk_in", "referral", "instagram", "facebook", "google", "website", "whatsapp", "other"],
      default: "other",
    },
    status: {
      type: String,
      enum: ["new", "contacted", "trial_booked", "trial_done", "enrolled", "lost", "on_hold"],
      default: "new",
    },
    notes: String,
    assignedSalesUser: { type: Schema.Types.ObjectId, ref: "User" },
    followUpDate: Date,
    convertedToStudentId: { type: Schema.Types.ObjectId, ref: "Student" },
  },
  { timestamps: true }
);

LeadSchema.index({ status: 1, createdAt: -1 });
LeadSchema.index({ assignedSalesUser: 1 });
LeadSchema.index({ studentPhone: 1 });

export default mongoose.models.Lead || mongoose.model<ILead>("Lead", LeadSchema);
