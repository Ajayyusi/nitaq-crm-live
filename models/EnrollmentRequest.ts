import mongoose, { Document, Schema } from "mongoose";

export const enrollmentRequestStatuses = ["Pending", "Approved", "Rejected", "More Info Needed"] as const;
export type EnrollmentRequestStatus = (typeof enrollmentRequestStatuses)[number];

export interface IEnrollmentRequest extends Document {
  leadId?: mongoose.Types.ObjectId;
  leadRef: string;        // human-readable lead ID (e.g. L-001)
  leadName: string;
  leadPhone: string;
  course: string;
  salesName: string;      // name of the sales user who submitted
  salesEmail: string;
  notes?: string;
  expectedStartDate?: Date;
  status: EnrollmentRequestStatus;
  reviewedBy?: string;
  reviewNote?: string;
  reviewedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const EnrollmentRequestSchema = new Schema<IEnrollmentRequest>(
  {
    leadId: { type: Schema.Types.ObjectId, ref: "Lead" },
    leadRef: { type: String, trim: true, maxlength: 30 },
    leadName: { type: String, required: true, trim: true, maxlength: 120 },
    leadPhone: { type: String, required: true, trim: true, maxlength: 30 },
    course: { type: String, required: true, trim: true, maxlength: 160 },
    salesName: { type: String, required: true, trim: true, maxlength: 120 },
    salesEmail: { type: String, required: true, trim: true, maxlength: 160 },
    notes: { type: String, trim: true, maxlength: 2000 },
    expectedStartDate: { type: Date },
    status: {
      type: String,
      enum: [...enrollmentRequestStatuses],
      default: "Pending",
      required: true,
    },
    reviewedBy: { type: String, trim: true, maxlength: 120 },
    reviewNote: { type: String, trim: true, maxlength: 1000 },
    reviewedAt: { type: Date },
  },
  { timestamps: true },
);

EnrollmentRequestSchema.index({ status: 1, createdAt: -1 });
EnrollmentRequestSchema.index({ salesEmail: 1, createdAt: -1 });

const EnrollmentRequest =
  (mongoose.models.EnrollmentRequest as mongoose.Model<IEnrollmentRequest>) ||
  mongoose.model<IEnrollmentRequest>("EnrollmentRequest", EnrollmentRequestSchema);

export default EnrollmentRequest;
