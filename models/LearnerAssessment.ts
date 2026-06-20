import mongoose, { Schema, type Document, type Types } from "mongoose";

export const assessmentStatuses = [
  "Not Submitted",
  "Submitted",
  "Under Assessment",
  "Referred",
  "Resubmitted",
  "Passed",
] as const;
export type AssessmentStatus = (typeof assessmentStatuses)[number];

// ── Sub-document interface ────────────────────────────────────────────────────
export interface IResubmission {
  submittedAt: Date;
  feedback: string;
  grade?: string;
  by: string;
}

// ── Main interface ────────────────────────────────────────────────────────────
export interface ILearnerAssessment extends Document {
  learnerProfileId: Types.ObjectId;  // ref: LearnerProfile
  qualificationId: Types.ObjectId;   // ref: Qualification
  unitCode: string;
  unitTitle: string;
  assignmentBrief?: string;
  dueDate?: Date;
  submittedAt?: Date;
  markingDeadline?: Date;
  status: AssessmentStatus;
  assessorId?: Types.ObjectId;       // ref: User
  assessorFeedback?: string;
  grade?: string;
  resubmissions: IResubmission[];
  fileRef?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ── Schemas ───────────────────────────────────────────────────────────────────
const ResubmissionSchema = new Schema<IResubmission>(
  {
    submittedAt: { type: Date, required: true },
    feedback:    { type: String, trim: true, maxlength: 5000 },
    grade:       { type: String, trim: true, maxlength: 20 },
    by:          { type: String, trim: true, maxlength: 120 },
  },
  { _id: false }
);

const LearnerAssessmentSchema = new Schema<ILearnerAssessment>(
  {
    learnerProfileId: { type: Schema.Types.ObjectId, ref: "LearnerProfile", required: true },
    qualificationId:  { type: Schema.Types.ObjectId, ref: "Qualification", required: true },
    unitCode:         { type: String, required: true, trim: true, maxlength: 40 },
    unitTitle:        { type: String, required: true, trim: true, maxlength: 200 },
    assignmentBrief:  { type: String, trim: true, maxlength: 2000 },
    dueDate:          { type: Date },
    submittedAt:      { type: Date },
    markingDeadline:  { type: Date },
    status:           { type: String, enum: assessmentStatuses, default: "Not Submitted" },
    assessorId:       { type: Schema.Types.ObjectId, ref: "User" },
    assessorFeedback: { type: String, trim: true, maxlength: 5000 },
    grade:            { type: String, trim: true, maxlength: 20 },
    resubmissions:    [ResubmissionSchema],
    fileRef:          { type: String, trim: true, maxlength: 500 },
  },
  { timestamps: true }
);

LearnerAssessmentSchema.index({ learnerProfileId: 1 });
LearnerAssessmentSchema.index({ qualificationId: 1, status: 1 });
LearnerAssessmentSchema.index({ dueDate: 1, status: 1 });
LearnerAssessmentSchema.index({ markingDeadline: 1, status: 1 });

export default mongoose.models.LearnerAssessment ??
  mongoose.model<ILearnerAssessment>("LearnerAssessment", LearnerAssessmentSchema);
