import mongoose, { Schema, Document } from "mongoose";

/**
 * In-app notification. Targeted either at a specific user (by email) or at
 * every user of a role (roleTarget, e.g. "admin").
 */
export interface INotification extends Document {
  userEmail?: string;
  roleTarget?: string;
  title: string;
  body?: string;
  link?: string;
  read: boolean;
  createdAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    userEmail:  { type: String, trim: true, lowercase: true },
    roleTarget: { type: String, trim: true },
    title:      { type: String, required: true, trim: true, maxlength: 200 },
    body:       { type: String, trim: true, maxlength: 500 },
    link:       { type: String, trim: true, maxlength: 300 },
    read:       { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

NotificationSchema.index({ userEmail: 1, read: 1, createdAt: -1 });
NotificationSchema.index({ roleTarget: 1, createdAt: -1 });
// Auto-expire after 60 days to protect the free-tier database
NotificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 24 * 3600 });

export default (mongoose.models.Notification as mongoose.Model<INotification>) ||
  mongoose.model<INotification>("Notification", NotificationSchema);
