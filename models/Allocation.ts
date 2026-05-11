import mongoose, { Schema, Document } from "mongoose";

export interface IAllocation extends Document {
  leadId: mongoose.Types.ObjectId;
  courseId?: mongoose.Types.ObjectId;
  subjectId?: mongoose.Types.ObjectId;
  teacherId: mongoose.Types.ObjectId;
  backupTeacherId?: mongoose.Types.ObjectId;
  allocatedBy: mongoose.Types.ObjectId;
  allocationDate: Date;
  status: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const AllocationSchema = new Schema<IAllocation>(
  {
    leadId: { type: Schema.Types.ObjectId, ref: "Lead", required: true },
    courseId: { type: Schema.Types.ObjectId, ref: "Course" },
    subjectId: { type: Schema.Types.ObjectId, ref: "Subject" },
    teacherId: { type: Schema.Types.ObjectId, ref: "Teacher", required: true },
    backupTeacherId: { type: Schema.Types.ObjectId, ref: "Teacher" },
    allocatedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    allocationDate: { type: Date, default: Date.now },
    status: {
      type: String,
      enum: ["pending", "confirmed", "active", "completed", "cancelled"],
      default: "pending",
    },
    notes: String,
  },
  { timestamps: true }
);

export default mongoose.models.Allocation ||
  mongoose.model<IAllocation>("Allocation", AllocationSchema);
