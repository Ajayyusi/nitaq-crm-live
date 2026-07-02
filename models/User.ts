import mongoose, { Schema, Document } from "mongoose";

export const userRoles = [
  "admin", "manager", "sales", "finance", "trainer",
  "assessor", "iqa", "eqa",
] as const;
export type UserRole = (typeof userRoles)[number];

export interface IUser extends Document {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  active: boolean;
  mobileNumber?: string;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    name:         { type: String, required: true, trim: true },
    email:        { type: String, required: true, unique: true, lowercase: true, trim: true },
    // select:false — hash never leaves the DB unless explicitly requested with .select("+password")
    password:     { type: String, required: true, select: false },
    role:         { type: String, enum: [...userRoles], default: "sales" },
    active:       { type: Boolean, default: true },
    mobileNumber: { type: String, trim: true },
    lastLogin:    Date,
  },
  { timestamps: true }
);

const User =
  (mongoose.models.User as mongoose.Model<IUser>) ||
  mongoose.model<IUser>("User", UserSchema);

export default User;
