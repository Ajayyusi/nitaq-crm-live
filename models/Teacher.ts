import mongoose, { Schema, Document } from "mongoose";

export const trainerStatuses = ["Active", "Inactive"] as const;
export const tamamStatuses = ["Registered", "Pending", "Not Registered"] as const;
export const contractStatuses = ["Active", "Expired", "No Contract"] as const;
export const paymentTypes = ["Per Session", "Per Course", "Monthly"] as const;

export type TrainerStatus = (typeof trainerStatuses)[number];
export type TamamStatus = (typeof tamamStatuses)[number];
export type ContractStatus = (typeof contractStatuses)[number];
export type PaymentType = (typeof paymentTypes)[number];

export interface ITeacher extends Document {
  fullName: string;
  fullNameAr?: string;
  phone: string;
  email?: string;
  emiratesId?: string;
  nationality?: string;
  specialisation?: string;
  qualifications?: string;
  tamamStatus: TamamStatus;
  tamamNumber?: string;
  contractStatus: ContractStatus;
  contractStartDate?: Date;
  contractEndDate?: Date;
  paymentRate?: number;
  paymentType: PaymentType;
  status: TrainerStatus;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const TeacherSchema = new Schema<ITeacher>(
  {
    fullName: { type: String, required: true, trim: true, maxlength: 120 },
    fullNameAr: { type: String, trim: true, maxlength: 120 },
    phone: { type: String, required: true, trim: true, maxlength: 30 },
    email: { type: String, lowercase: true, trim: true },
    emiratesId: { type: String, trim: true },
    nationality: { type: String, trim: true, maxlength: 80 },
    specialisation: { type: String, trim: true, maxlength: 300 },
    qualifications: { type: String, trim: true, maxlength: 1000 },
    tamamStatus: {
      type: String,
      enum: [...tamamStatuses],
      default: "Not Registered",
    },
    tamamNumber: { type: String, trim: true },
    contractStatus: {
      type: String,
      enum: [...contractStatuses],
      default: "No Contract",
    },
    contractStartDate: Date,
    contractEndDate: Date,
    paymentRate: Number,
    paymentType: {
      type: String,
      enum: [...paymentTypes],
      default: "Per Session",
    },
    status: { type: String, enum: [...trainerStatuses], default: "Active" },
    notes: { type: String, trim: true, maxlength: 2000 },
  },
  { timestamps: true },
);

export default (mongoose.models.Teacher as mongoose.Model<ITeacher>) ||
  mongoose.model<ITeacher>("Teacher", TeacherSchema);
