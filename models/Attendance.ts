import mongoose, { Schema, Document } from "mongoose";

export const attendanceStatuses = ["Present", "Absent", "Late", "Excused"] as const;
export type AttendanceStatus = (typeof attendanceStatuses)[number];

export interface IAttendanceRecord {
  enrollmentId: mongoose.Types.ObjectId;
  studentName: string;
  status: AttendanceStatus;
  notes?: string;
}

export interface IAttendanceSession extends Document {
  course: string;
  batchName?: string;
  sessionDate: Date;
  sessionNumber?: number;
  topic?: string;
  trainerName?: string;
  records: IAttendanceRecord[];
  createdAt: Date;
  updatedAt: Date;
}

const AttendanceRecordSchema = new Schema<IAttendanceRecord>(
  {
    enrollmentId: { type: Schema.Types.ObjectId, ref: "Enrollment", required: true },
    studentName: { type: String, required: true, trim: true },
    status: { type: String, enum: [...attendanceStatuses], required: true, default: "Present" },
    notes: { type: String, trim: true, maxlength: 500 },
  },
  { _id: false },
);

const AttendanceSessionSchema = new Schema<IAttendanceSession>(
  {
    course: { type: String, required: true, trim: true },
    batchName: { type: String, trim: true },
    sessionDate: { type: Date, required: true },
    sessionNumber: { type: Number },
    topic: { type: String, trim: true },
    trainerName: { type: String, trim: true },
    records: [AttendanceRecordSchema],
  },
  { timestamps: true },
);

AttendanceSessionSchema.index({ course: 1, sessionDate: -1 });

export const AttendanceSession =
  (mongoose.models.AttendanceSession as mongoose.Model<IAttendanceSession>) ||
  mongoose.model<IAttendanceSession>("AttendanceSession", AttendanceSessionSchema);

export default AttendanceSession;
