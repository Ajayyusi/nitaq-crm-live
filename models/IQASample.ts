import mongoose, { Schema, type Document, type Types } from "mongoose";

export const iqaSampleStatuses = [
  "Planned",
  "In Progress",
  "Completed",
  "Action Required",
] as const;
export type IQASampleStatus = (typeof iqaSampleStatuses)[number];

export const iqaOutcomes = [
  "Confirmed",
  "Action Required",
  "Referral Upheld",
  "Referral Overturned",
] as const;
export type IQAOutcome = (typeof iqaOutcomes)[number];

export interface IIQASample extends Document {
  assessmentId:    Types.ObjectId;
  learnerProfileId: Types.ObjectId;
  qualificationId:  Types.ObjectId;
  unitCode:         string;
  sampledBy:        string;        // IQA user name
  sampledAt:        Date;
  status:           IQASampleStatus;
  outcome?:         IQAOutcome;
  feedback?:        string;
  actionRequired?:  string;
  actionDueDate?:   Date;
  actionCompleted?: boolean;
  createdAt:        Date;
  updatedAt:        Date;
}

const IQASampleSchema = new Schema<IIQASample>(
  {
    assessmentId:     { type: Schema.Types.ObjectId, ref: "LearnerAssessment", required: true },
    learnerProfileId: { type: Schema.Types.ObjectId, ref: "LearnerProfile", required: true },
    qualificationId:  { type: Schema.Types.ObjectId, ref: "Qualification", required: true },
    unitCode:         { type: String, required: true, trim: true },
    sampledBy:        { type: String, required: true, trim: true },
    sampledAt:        { type: Date, default: () => new Date() },
    status:           { type: String, enum: iqaSampleStatuses, default: "Planned" },
    outcome:          { type: String, enum: [...iqaOutcomes, null], default: null },
    feedback:         { type: String, trim: true, maxlength: 4000 },
    actionRequired:   { type: String, trim: true, maxlength: 2000 },
    actionDueDate:    Date,
    actionCompleted:  { type: Boolean, default: false },
  },
  { timestamps: true }
);

IQASampleSchema.index({ learnerProfileId: 1 });
IQASampleSchema.index({ qualificationId: 1, status: 1 });
IQASampleSchema.index({ assessmentId: 1 }, { unique: true });
IQASampleSchema.index({ sampledAt: -1 });

export default mongoose.models.IQASample ??
  mongoose.model<IIQASample>("IQASample", IQASampleSchema);
