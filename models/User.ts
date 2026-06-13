import mongoose, { Schema, Document } from "mongoose";

export const userRoles = ["admin", "manager", "sales", "finance", "trainer"] as const;
export type UserRole = (typeof userRoles)[number];

export interface IUser extends Document {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  active: boolean;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    name:      { type: String, required: true, trim: true },
    email:     { type: String, required: true, unique: true, lowercase: true, trim: true },
    password:  { type: String, required: true },
    role:      { type: String, enum: [...userRoles], default: "sales" },
    active:    { type: Boolean, default: true },
    lastLogin: Date,
  },
  { timestamps: true }
);

const User =
  (mongoose.models.User as mongoose.Model<IUser>) ||
  mongoose.model<IUser>("User", UserSchema);

export default User;
