import mongoose, { Schema, type Document, type Types } from "mongoose";

export const staffDocTypes = [
  "DBS Check",
  "Right to Work",
  "Teaching Qualification",
  "Assessor Award (D32/D33/A1/TAQA)",
  "IQA Award (D34/V1/TAQA)",
  "CPD Record",
  "Contract",
  "ID Document",
  "Medical Certificate",
  "Other",
] as const;
export type StaffDocType = (typeof staffDocTypes)[number];

export const staffDocStatuses = [
  "Valid",
  "Expired",
  "Missing",
  "Pending Review",
] as const;
export type StaffDocStatus = (typeof staffDocStatuses)[number];

export interface IStaffDocRecord {
  docType:    StaffDocType | string;
  status:     StaffDocStatus | string;
  issueDate?: Date;
  expiryDate?: Date;
  reference?:  string;
  notes?:      string;
}

export interface IStaffCompliance extends Document {
  userId?:       Types.ObjectId;  // ref: User (optional – can log without user account)
  staffName:     string;
  staffRole:     string;
  email?:        string;
  phone?:        string;
  documents:     IStaffDocRecord[];
  notes?:        string;
  isActive:      boolean;
  createdAt:     Date;
  updatedAt:     Date;
}

const StaffDocRecordSchema = new Schema<IStaffDocRecord>(
  {
    docType:    { type: String, required: true, trim: true },
    status:     { type: String, required: true, trim: true, default: "Missing" },
    issueDate:  Date,
    expiryDate: Date,
    reference:  { type: String, trim: true, maxlength: 200 },
    notes:      { type: String, trim: true, maxlength: 1000 },
  },
  { _id: false }
);

const StaffComplianceSchema = new Schema<IStaffCompliance>(
  {
    userId:    { type: Schema.Types.ObjectId, ref: "User" },
    staffName: { type: String, required: true, trim: true, maxlength: 200 },
    staffRole: { type: String, required: true, trim: true, maxlength: 100 },
    email:     { type: String, trim: true, lowercase: true },
    phone:     { type: String, trim: true },
    documents: [StaffDocRecordSchema],
    notes:     { type: String, trim: true, maxlength: 2000 },
    isActive:  { type: Boolean, default: true },
  },
  { timestamps: true }
);

StaffComplianceSchema.index({ staffName: "text" });
StaffComplianceSchema.index({ isActive: 1 });

export default mongoose.models.StaffCompliance ??
  mongoose.model<IStaffCompliance>("StaffCompliance", StaffComplianceSchema);
