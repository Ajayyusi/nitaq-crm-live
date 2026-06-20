import mongoose, { Schema, type Document, type Types } from "mongoose";

export const qualificationStatuses = ["Active", "Inactive", "Pending Approval"] as const;
export type QualificationStatus = (typeof qualificationStatuses)[number];

export const awardingBodies = ["Qualifi", "Pearson", "City & Guilds", "OTHM", "ATHE", "Other"] as const;
export type AwardingBody = (typeof awardingBodies)[number];

// ── Unit sub-document ─────────────────────────────────────────────────────────
export interface IUnit {
  unitCode: string;
  unitTitle: string;
  level?: string;
  credits?: number;
  glh?: number;                 // Guided Learning Hours
  learningOutcomes?: string;    // numbered LOs as text block
  assessmentCriteria?: string;  // numbered ACs as text block
  isMandatory: boolean;
}

// ── Main interface ────────────────────────────────────────────────────────────
export interface IQualification extends Document {
  title: string;
  awardingBody: string;
  level: string;                // "3" | "4" | "5" | "6" | "7" | "8" | custom
  qualificationCode?: string;
  credits?: number;
  glh?: number;
  tqt?: number;                 // Total Qualification Time
  units: IUnit[];
  tutorId?: Types.ObjectId;     // ref: User
  assessorId?: Types.ObjectId;  // ref: User
  iqaId?: Types.ObjectId;       // ref: User
  status: QualificationStatus;
  createdAt: Date;
  updatedAt: Date;
}

// ── Schemas ───────────────────────────────────────────────────────────────────
const UnitSchema = new Schema<IUnit>(
  {
    unitCode:           { type: String, required: true, trim: true, maxlength: 40 },
    unitTitle:          { type: String, required: true, trim: true, maxlength: 200 },
    level:              { type: String, trim: true, maxlength: 10 },
    credits:            { type: Number, min: 0 },
    glh:                { type: Number, min: 0 },
    learningOutcomes:   { type: String, trim: true, maxlength: 8000 },
    assessmentCriteria: { type: String, trim: true, maxlength: 8000 },
    isMandatory:        { type: Boolean, default: true },
  },
  { _id: false }
);

const QualificationSchema = new Schema<IQualification>(
  {
    title:             { type: String, required: true, trim: true, maxlength: 300 },
    awardingBody:      { type: String, required: true, trim: true, maxlength: 100, default: "Qualifi" },
    level:             { type: String, required: true, trim: true, maxlength: 20 },
    qualificationCode: { type: String, trim: true, maxlength: 60 },
    credits:           { type: Number, min: 0 },
    glh:               { type: Number, min: 0 },
    tqt:               { type: Number, min: 0 },
    units:             [UnitSchema],
    tutorId:           { type: Schema.Types.ObjectId, ref: "User" },
    assessorId:        { type: Schema.Types.ObjectId, ref: "User" },
    iqaId:             { type: Schema.Types.ObjectId, ref: "User" },
    status:            { type: String, enum: qualificationStatuses, default: "Active" },
  },
  { timestamps: true }
);

QualificationSchema.index({ awardingBody: 1, status: 1 });
QualificationSchema.index({ level: 1 });

export default mongoose.models.Qualification ??
  mongoose.model<IQualification>("Qualification", QualificationSchema);
