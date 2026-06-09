import mongoose, { Document, Schema } from "mongoose";

export const followUpTypes = [
  "WhatsApp Message",
  "Phone Call",
  "Send Brochure",
  "Send Pricing",
  "In-Person",
  "Email",
  "Other",
] as const;

export const followUpStatuses = [
  "Pending",
  "Done",
  "No Response",
  "Rescheduled",
] as const;

export type FollowUpType = (typeof followUpTypes)[number];
export type FollowUpStatus = (typeof followUpStatuses)[number];

export interface IFollowUp extends Document {
  leadId?: mongoose.Types.ObjectId;
  contactName: string;
  phone: string;
  course?: string;
  followUpDate: Date;
  type: FollowUpType;
  notes?: string;
  status: FollowUpStatus;
  assignedTo?: string;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const FollowUpSchema = new Schema<IFollowUp>(
  {
    leadId: { type: Schema.Types.ObjectId, ref: "Lead" },
    contactName: { type: String, required: true, trim: true, maxlength: 120 },
    phone: { type: String, required: true, trim: true, maxlength: 30 },
    course: { type: String, trim: true, maxlength: 160 },
    followUpDate: { type: Date, required: true },
    type: {
      type: String,
      enum: [...followUpTypes],
      required: true,
      default: "WhatsApp Message",
    },
    notes: { type: String, trim: true, maxlength: 2000 },
    status: {
      type: String,
      enum: [...followUpStatuses],
      required: true,
      default: "Pending",
    },
    assignedTo: { type: String, trim: true, maxlength: 120 },
    createdBy: { type: String, trim: true, maxlength: 120 },
  },
  { timestamps: true },
);

FollowUpSchema.index({ followUpDate: 1, status: 1 });
FollowUpSchema.index({ status: 1, createdAt: -1 });

const FollowUp =
  (mongoose.models.FollowUp as mongoose.Model<IFollowUp>) ||
  mongoose.model<IFollowUp>("FollowUp", FollowUpSchema);

export default FollowUp;
