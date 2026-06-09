import mongoose, { Document, Schema } from "mongoose";

export const courseCategories = [
  "Computer Software Training",
  "Business & Admin Training",
  "Supportive Education",
  "Language",
] as const;

export const courseStatuses = ["Active", "Coming Soon", "Inactive"] as const;
export const batchFormats = ["In-Person", "Online", "Hybrid"] as const;
export const batchStatuses = ["Open", "In Progress", "Completed", "Cancelled"] as const;

export type CourseCategory = (typeof courseCategories)[number];
export type CourseStatus = (typeof courseStatuses)[number];
export type BatchFormat = (typeof batchFormats)[number];
export type BatchStatus = (typeof batchStatuses)[number];

export interface IBatch {
  _id?: mongoose.Types.ObjectId;
  batchId: string;
  batchName: string;
  startDate?: Date;
  endDate?: Date;
  schedule?: string;
  format: BatchFormat;
  trainerName?: string;
  maxStudents?: number;
  status: BatchStatus;
}

export interface ICourse extends Document {
  courseCode: string;
  courseName: string;
  category: CourseCategory;
  description?: string;
  durationWeeks?: number;
  totalSessions?: number;
  sessionsPerWeek?: number;
  hoursPerSession?: number;
  totalHours?: number;
  priceExVat: number;
  vatRate: number;
  maxStudentsPerBatch?: number;
  status: CourseStatus;
  speaActivity?: string;
  batches: IBatch[];
  createdAt: Date;
  updatedAt: Date;
}

const BatchSchema = new Schema<IBatch>({
  batchId: { type: String, required: true },
  batchName: { type: String, required: true, trim: true },
  startDate: Date,
  endDate: Date,
  schedule: String,
  format: { type: String, enum: [...batchFormats], default: "In-Person" },
  trainerName: String,
  maxStudents: Number,
  status: { type: String, enum: [...batchStatuses], default: "Open" },
});

const CourseSchema = new Schema<ICourse>(
  {
    courseCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    courseName: { type: String, required: true, trim: true, maxlength: 200 },
    category: { type: String, enum: [...courseCategories], required: true },
    description: { type: String, trim: true, maxlength: 2000 },
    durationWeeks: Number,
    totalSessions: Number,
    sessionsPerWeek: Number,
    hoursPerSession: Number,
    totalHours: Number,
    priceExVat: { type: Number, required: true, min: 0, default: 0 },
    vatRate: { type: Number, default: 5, min: 0, max: 100 },
    maxStudentsPerBatch: Number,
    status: { type: String, enum: [...courseStatuses], default: "Active" },
    speaActivity: { type: String, trim: true },
    batches: { type: [BatchSchema], default: [] },
  },
  { timestamps: true },
);

const Course =
  (mongoose.models.Course as mongoose.Model<ICourse>) ||
  mongoose.model<ICourse>("Course", CourseSchema);

export default Course;
