import mongoose, { Schema } from "mongoose";

export interface IAuditLog {
  _id: mongoose.Types.ObjectId;
  userName: string;
  userRole: string;
  action: string;         // "created" | "updated" | "deleted" | "status_changed"
  entity: string;         // "Lead" | "FollowUp" | "Enrollment" | "Payment" | "Student"
  entityId: string;
  entityLabel: string;    // human-readable: lead name, student name, etc.
  detail: string;         // what changed, e.g. "Stage: Lead → Interested"
  createdAt: Date;
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    userName:    { type: String, required: true, trim: true, maxlength: 120 },
    userRole:    { type: String, required: true, trim: true, maxlength: 40 },
    action:      { type: String, required: true, trim: true, maxlength: 40 },
    entity:      { type: String, required: true, trim: true, maxlength: 40 },
    entityId:    { type: String, required: true, trim: true, maxlength: 60 },
    entityLabel: { type: String, required: true, trim: true, maxlength: 200 },
    detail:      { type: String, default: "", trim: true, maxlength: 500 },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

AuditLogSchema.index({ createdAt: -1 });
AuditLogSchema.index({ userName: 1, createdAt: -1 });
AuditLogSchema.index({ entity: 1, entityId: 1 });

export default mongoose.models.AuditLog ??
  mongoose.model<IAuditLog>("AuditLog", AuditLogSchema);
