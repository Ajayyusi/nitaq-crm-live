import mongoose, { Schema, Document } from "mongoose";

export interface IUser extends Document {
  name: string;
  email: string;
  password: string;
  role: string;
  active: boolean;
  phone?: string;
  avatar?: string;
  teacherId?: mongoose.Types.ObjectId;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true },
    role: {
      type: String,
      enum: ["super_admin", "admin", "sales", "teacher", "finance", "academic"],
      default: "sales",
    },
    active: { type: Boolean, default: true },
    phone: String,
    avatar: String,
    teacherId: { type: Schema.Types.ObjectId, ref: "Teacher" },
    lastLogin: Date,
  },
  { timestamps: true }
);

export default mongoose.models.User || mongoose.model<IUser>("User", UserSchema);
