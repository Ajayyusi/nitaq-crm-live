import mongoose, { Schema, type Document, type Types } from "mongoose";

// ── Document types ────────────────────────────────────────────────────────────
export const documentTypes = [
  "Emirates ID",
  "Passport",
  "Visa",
  "Photo",
  "Qualification Certificate",
  "Previous Education Certificate",
  "English Proficiency Test",
  "Medical Certificate",
  "Other",
] as const;
export type DocumentType = (typeof documentTypes)[number];

export const documentStatuses = ["Present", "Missing", "Expired", "Pending Review"] as const;
export type DocumentStatus = (typeof documentStatuses)[number];

export const riskLevels = ["Low", "Medium", "High"] as const;
export type RiskLevel = (typeof riskLevels)[number];

// ── Sub-document interfaces ───────────────────────────────────────────────────
export interface ICommsEntry {
  note: string;
  by: string;
  at: Date;
}

export interface IDocumentRecord {
  docType: DocumentType;
  label?: string;        // custom label when docType = "Other"
  status: DocumentStatus;
  expiryDate?: Date;
  uploadRef?: string;    // cloud storage URL or file reference
  verifiedBy?: string;
  verifiedAt?: Date;
  notes?: string;
}

// ── Main interface ────────────────────────────────────────────────────────────
export interface ILearnerProfile extends Document {
  enrollmentId: Types.ObjectId;            // 1:1 with Enrollment
  fullName: string;
  phone: string;
  email?: string;
  emiratesId?: string;
  emiratesIdExpiry?: Date;
  passportNumber?: string;
  passportExpiry?: Date;
  visaNumber?: string;
  visaExpiry?: Date;
  photoOnFile: boolean;
  nationality?: string;
  dateOfBirth?: Date;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactRelation?: string;
  documents: IDocumentRecord[];
  riskStatus: RiskLevel;
  riskNotes?: string;
  commsLog: ICommsEntry[];
  qualificationIds: Types.ObjectId[];      // refs to Qualification
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ── Sub-document schemas ──────────────────────────────────────────────────────
const DocumentRecordSchema = new Schema<IDocumentRecord>(
  {
    docType:    { type: String, enum: documentTypes, required: true },
    label:      { type: String, trim: true, maxlength: 120 },
    status:     { type: String, enum: documentStatuses, required: true, default: "Missing" },
    expiryDate: { type: Date },
    uploadRef:  { type: String, trim: true, maxlength: 500 },
    verifiedBy: { type: String, trim: true, maxlength: 120 },
    verifiedAt: { type: Date },
    notes:      { type: String, trim: true, maxlength: 500 },
  },
  { _id: false }
);

const CommsEntrySchema = new Schema<ICommsEntry>(
  {
    note: { type: String, required: true, trim: true, maxlength: 2000 },
    by:   { type: String, required: true, trim: true, maxlength: 120 },
    at:   { type: Date, required: true, default: () => new Date() },
  },
  { _id: false }
);

// ── Main schema ───────────────────────────────────────────────────────────────
const LearnerProfileSchema = new Schema<ILearnerProfile>(
  {
    enrollmentId:             { type: Schema.Types.ObjectId, ref: "Enrollment", required: true, unique: true },
    fullName:                 { type: String, required: true, trim: true, maxlength: 120 },
    phone:                    { type: String, required: true, trim: true, maxlength: 30 },
    email:                    { type: String, trim: true, lowercase: true },
    emiratesId:               { type: String, trim: true },
    emiratesIdExpiry:         { type: Date },
    passportNumber:           { type: String, trim: true },
    passportExpiry:           { type: Date },
    visaNumber:               { type: String, trim: true },
    visaExpiry:               { type: Date },
    photoOnFile:              { type: Boolean, default: false },
    nationality:              { type: String, trim: true, maxlength: 80 },
    dateOfBirth:              { type: Date },
    emergencyContactName:     { type: String, trim: true, maxlength: 120 },
    emergencyContactPhone:    { type: String, trim: true, maxlength: 30 },
    emergencyContactRelation: { type: String, trim: true, maxlength: 80 },
    documents:                [DocumentRecordSchema],
    riskStatus:               { type: String, enum: riskLevels, default: "Low" },
    riskNotes:                { type: String, trim: true, maxlength: 2000 },
    commsLog:                 [CommsEntrySchema],
    qualificationIds:         [{ type: Schema.Types.ObjectId, ref: "Qualification" }],
    isActive:                 { type: Boolean, default: true },
  },
  { timestamps: true }
);

LearnerProfileSchema.index({ fullName: "text" });
LearnerProfileSchema.index({ riskStatus: 1, isActive: 1 });
LearnerProfileSchema.index({ enrollmentId: 1 });

export default mongoose.models.LearnerProfile ??
  mongoose.model<ILearnerProfile>("LearnerProfile", LearnerProfileSchema);
