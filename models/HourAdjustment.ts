import mongoose, { Schema, Document } from "mongoose";

export const adjustmentTypes = ["Add Hours", "Deduct Hours", "Correction"] as const;
export type AdjustmentType = (typeof adjustmentTypes)[number];

/**
 * Manual hour adjustment on a course registration (admin/manager only, with
 * a mandatory reason). Positive hours = counted as completed (deducted from
 * remaining); negative via "Add Hours" gives hours back.
 */
export interface IHourAdjustment extends Document {
  enrollmentId: mongoose.Types.ObjectId;
  adjustmentType: AdjustmentType;
  hours: number;              // always positive; type determines direction
  reason: string;
  createdBy: string;
  createdAt: Date;
}

const HourAdjustmentSchema = new Schema<IHourAdjustment>(
  {
    enrollmentId:   { type: Schema.Types.ObjectId, ref: "Enrollment", required: true },
    adjustmentType: { type: String, enum: adjustmentTypes, required: true },
    hours:          { type: Number, required: true, min: 0.25 },
    reason:         { type: String, required: true, trim: true, minlength: 3, maxlength: 500 },
    createdBy:      { type: String, required: true, trim: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

HourAdjustmentSchema.index({ enrollmentId: 1, createdAt: -1 });

export default (mongoose.models.HourAdjustment as mongoose.Model<IHourAdjustment>) ||
  mongoose.model<IHourAdjustment>("HourAdjustment", HourAdjustmentSchema);
