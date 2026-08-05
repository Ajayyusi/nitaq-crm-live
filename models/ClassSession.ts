import mongoose, { Schema, Document } from "mongoose";

export const attendanceStatusesCS = ["Present", "Absent", "Late", "Excused"] as const;
export const classStatuses = ["Scheduled", "Completed", "Cancelled", "No Show"] as const;

export type CSAttendance = (typeof attendanceStatusesCS)[number];
export type ClassStatus = (typeof classStatuses)[number];

/**
 * One teaching session for ONE student's course registration (Enrollment).
 * Completed + chargeable sessions consume the registration's hours; the
 * Enrollment.completedHours total is always recalculated from these records
 * (see lib/hours.ts) — never edited directly.
 */
export interface IClassSession extends Document {
  enrollmentId: mongoose.Types.ObjectId;   // the course registration
  studentName: string;                     // denormalized
  course: string;
  teacherId?: mongoose.Types.ObjectId;
  teacherName: string;                     // teacher at the time of the class (preserved on reassignment)
  classDate: Date;
  startTime?: string;                      // "16:00"
  endTime?: string;                        // "18:00"
  deliveredHours: number;
  attendanceStatus: CSAttendance;
  classStatus: ClassStatus;
  isChargeable: boolean;                   // admin override: charge an Absent/No Show session
  lessonTopic?: string;
  notes?: string;
  homework?: string;
  recordedBy: string;
  payoutId?: mongoose.Types.ObjectId;   // set once this session has been paid to the teacher
  createdAt: Date;
  updatedAt: Date;
}

const ClassSessionSchema = new Schema<IClassSession>(
  {
    enrollmentId: { type: Schema.Types.ObjectId, ref: "Enrollment", required: true },
    studentName:  { type: String, required: true, trim: true },
    course:       { type: String, required: true, trim: true },
    teacherId:    { type: Schema.Types.ObjectId, ref: "Teacher" },
    teacherName:  { type: String, required: true, trim: true },
    classDate:    { type: Date, required: true },
    startTime:    { type: String, trim: true, maxlength: 10 },
    endTime:      { type: String, trim: true, maxlength: 10 },
    deliveredHours: { type: Number, required: true, min: 0 },
    attendanceStatus: { type: String, enum: attendanceStatusesCS, default: "Present" },
    classStatus:  { type: String, enum: classStatuses, default: "Completed" },
    isChargeable: { type: Boolean, default: false },
    lessonTopic:  { type: String, trim: true, maxlength: 300 },
    notes:        { type: String, trim: true, maxlength: 2000 },
    homework:     { type: String, trim: true, maxlength: 1000 },
    recordedBy:   { type: String, required: true, trim: true },
    payoutId:     { type: Schema.Types.ObjectId, ref: "TeacherPayout", default: null },
  },
  { timestamps: true }
);

ClassSessionSchema.index({ enrollmentId: 1, classDate: -1 });
ClassSessionSchema.index({ teacherId: 1, classDate: -1 });
// Duplicate guard: same teacher+student+course+date+time
ClassSessionSchema.index(
  { enrollmentId: 1, teacherName: 1, classDate: 1, startTime: 1 },
  { unique: true, partialFilterExpression: { startTime: { $type: "string" } } }
);

export default (mongoose.models.ClassSession as mongoose.Model<IClassSession>) ||
  mongoose.model<IClassSession>("ClassSession", ClassSessionSchema);
