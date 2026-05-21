import mongoose, { Document, Schema } from "mongoose";

import { leadSources, leadStatuses, type LeadSource, type LeadStatus } from "@/constants/leads";

export interface ILead extends Document {
  fullName: string;
  phone: string;
  email?: string;
  interestedCourse: string;
  source: LeadSource;
  status: LeadStatus;
  notes?: string;
  nextFollowUpDate?: Date;
  assignedTo?: string;
  createdAt: Date;
  updatedAt: Date;
}

const LeadSchema = new Schema<ILead>(
  {
    fullName: {
      type: String,
      required: [true, "Full name is required"],
      trim: true,
      maxlength: [120, "Full name cannot exceed 120 characters"],
    },
    phone: {
      type: String,
      required: [true, "Phone is required"],
      trim: true,
      maxlength: [30, "Phone cannot exceed 30 characters"],
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      match: [/^$|^\S+@\S+\.\S+$/, "Please enter a valid email address"],
    },
    interestedCourse: {
      type: String,
      required: [true, "Interested course is required"],
      trim: true,
      maxlength: [160, "Interested course cannot exceed 160 characters"],
    },
    source: {
      type: String,
      enum: [...leadSources],
      required: [true, "Lead source is required"],
      default: "Other",
    },
    status: {
      type: String,
      enum: [...leadStatuses],
      required: [true, "Lead status is required"],
      default: "New",
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [3000, "Notes cannot exceed 3000 characters"],
    },
    nextFollowUpDate: {
      type: Date,
    },
    assignedTo: {
      type: String,
      trim: true,
      maxlength: [120, "Assigned to cannot exceed 120 characters"],
    },
  },
  { timestamps: true },
);

LeadSchema.index({ status: 1, createdAt: -1 });
LeadSchema.index({ source: 1, createdAt: -1 });
LeadSchema.index({ fullName: "text", phone: "text", interestedCourse: "text", status: "text" });

const Lead = (mongoose.models.Lead as mongoose.Model<ILead>) || mongoose.model<ILead>("Lead", LeadSchema);

export default Lead;