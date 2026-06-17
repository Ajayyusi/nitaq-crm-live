import mongoose, { Document, Schema } from "mongoose";

import {
  leadSources,
  leadStages,
  courseList,
  type LeadSource,
  type LeadStage,
  type CourseOption,
} from "@/constants/leads";

export interface NoteEntry {
  text: string;
  by: string;
  at: Date;
}

export interface ILead extends Document {
  leadId: string;
  fullName: string;
  phone: string;
  email?: string;
  course: CourseOption;
  source: LeadSource;
  stage: LeadStage;
  notes?: string;
  noteLog?: NoteEntry[];
  customCourse?: string;
  nextFollowUpDate?: Date;
  assignedTo?: string;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const LeadSchema = new Schema<ILead>(
  {
    leadId: {
      type: String,
      unique: true,
      index: true,
    },
    fullName: {
      type: String,
      required: [true, "Full name is required"],
      trim: true,
      maxlength: [120, "Full name cannot exceed 120 characters"],
    },
    phone: {
      type: String,
      required: [true, "Phone number is required"],
      trim: true,
      maxlength: [30, "Phone cannot exceed 30 characters"],
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      match: [/^$|^\S+@\S+\.\S+$/, "Please enter a valid email address"],
    },
    course: {
      type: String,
      enum: [...courseList],
      required: [true, "Course interest is required"],
      default: "Other",
    },
    source: {
      type: String,
      enum: [...leadSources],
      required: [true, "Lead source is required"],
      default: "Other",
    },
    stage: {
      type: String,
      enum: [...leadStages],
      required: [true, "Lead stage is required"],
      default: "Lead",
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
    createdBy: {
      type: String,
      trim: true,
      maxlength: [120, "Created by cannot exceed 120 characters"],
    },
    noteLog: [
      {
        text: { type: String, required: true, trim: true, maxlength: 2000 },
        by:   { type: String, required: true, trim: true, maxlength: 120 },
        at:   { type: Date,   default: Date.now },
        _id: false,
      },
    ],
    customCourse: {
      type: String,
      trim: true,
      maxlength: [120, "Custom course name cannot exceed 120 characters"],
    },
  },
  { timestamps: true },
);

LeadSchema.index({ stage: 1, createdAt: -1 });
LeadSchema.index({ source: 1, createdAt: -1 });
LeadSchema.index({ fullName: "text", phone: "text", course: "text" });

const Lead =
  (mongoose.models.Lead as mongoose.Model<ILead>) ||
  mongoose.model<ILead>("Lead", LeadSchema);

export default Lead;
