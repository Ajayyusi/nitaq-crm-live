import mongoose, { Schema, Document } from "mongoose";

export interface ISettings extends Document {
  // Academy Info
  academyNameEn: string;
  academyNameAr: string;
  phone: string;
  whatsappNumber: string;
  email: string;
  website: string;
  address: string;
  city: string;
  // Finance defaults
  currency: string;
  vatEnabled: boolean;
  vatRate: number;
  vatNumber: string;
  receiptPrefix: string;
  createdAt: Date;
  updatedAt: Date;
}

const SettingsSchema = new Schema<ISettings>(
  {
    academyNameEn:  { type: String, default: "Nitaq Academy" },
    academyNameAr:  { type: String, default: "أكاديمية نطاق" },
    phone:          { type: String, default: "" },
    whatsappNumber: { type: String, default: "" },
    email:          { type: String, default: "" },
    website:        { type: String, default: "" },
    address:        { type: String, default: "" },
    city:           { type: String, default: "Sharjah" },
    currency:       { type: String, default: "AED" },
    vatEnabled:     { type: Boolean, default: false },
    vatRate:        { type: Number, default: 5 },
    vatNumber:      { type: String, default: "" },
    receiptPrefix:  { type: String, default: "NITAQ-R" },
  },
  { timestamps: true }
);

const Settings =
  (mongoose.models.Settings as mongoose.Model<ISettings>) ||
  mongoose.model<ISettings>("Settings", SettingsSchema);

export default Settings;

/** Fetch the singleton Settings document, creating it with defaults if absent. */
export async function getSettings(): Promise<ISettings> {
  const doc = await Settings.findOneAndUpdate(
    {},
    { $setOnInsert: {} },
    { upsert: true, new: true }
  );
  return doc!;
}
