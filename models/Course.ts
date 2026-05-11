import mongoose, { Schema, Document } from "mongoose";

export interface ICourse extends Document {
  name: string;
  category: string;
  description?: string;
  defaultPrice: number;
  onlinePrice: number;
  offlinePrice: number;
  currency: string;
  active: boolean;
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const CourseSchema = new Schema<ICourse>(
  {
    name: { type: String, required: true, trim: true },
    category: {
      type: String,
      enum: ["test_prep", "language", "school_support", "professional", "other"],
      required: true,
    },
    description: String,
    defaultPrice: { type: Number, default: 0 },
    onlinePrice: { type: Number, default: 0 },
    offlinePrice: { type: Number, default: 0 },
    currency: { type: String, default: "AED" },
    active: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

export default mongoose.models.Course || mongoose.model<ICourse>("Course", CourseSchema);
