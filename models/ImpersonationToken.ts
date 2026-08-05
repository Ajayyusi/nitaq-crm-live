import mongoose, { Schema, Document } from "mongoose";

/**
 * Single-use, short-lived ticket that lets an ADMIN open a session as
 * another (lower-privileged) user. The token is the only way to start an
 * impersonated session — it is consumed on first use and expires in 60s,
 * so it can't be replayed or shared.
 */
export interface IImpersonationToken extends Document {
  token: string;
  targetUserId: mongoose.Types.ObjectId;
  targetEmail: string;
  targetName: string;
  createdById: mongoose.Types.ObjectId;
  createdByEmail: string;
  createdByName: string;
  /** True for the ticket that hands an admin back their own account on Exit. */
  isReturn: boolean;
  usedAt?: Date;
  expiresAt: Date;
  createdAt: Date;
}

const ImpersonationTokenSchema = new Schema<IImpersonationToken>(
  {
    token:          { type: String, required: true, unique: true, index: true },
    targetUserId:   { type: Schema.Types.ObjectId, ref: "User", required: true },
    targetEmail:    { type: String, required: true, lowercase: true, trim: true },
    targetName:     { type: String, required: true, trim: true },
    createdById:    { type: Schema.Types.ObjectId, ref: "User", required: true },
    createdByEmail: { type: String, required: true, lowercase: true, trim: true },
    createdByName:  { type: String, required: true, trim: true },
    isReturn:       { type: Boolean, default: false },
    usedAt:         Date,
    expiresAt:      { type: Date, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Tokens self-destruct shortly after expiry
ImpersonationTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 300 });

export default (mongoose.models.ImpersonationToken as mongoose.Model<IImpersonationToken>) ||
  mongoose.model<IImpersonationToken>("ImpersonationToken", ImpersonationTokenSchema);
