/**
 * Teacher payroll: how a session's pay rate is resolved.
 *
 * The rule under test: pay is a property of the REGISTRATION (enrollment),
 * because a trainer can earn a different rate on IELTS than on SAT. The
 * trainer's own rate is only the fallback for registrations that don't set one,
 * so existing data keeps paying exactly as it did before this change.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import mongoose from "mongoose";
import { previewTeacherPayout } from "@/lib/payroll";
import Teacher from "@/models/Teacher";
import Enrollment from "@/models/Enrollment";
import ClassSession from "@/models/ClassSession";
import { connectTestDb, disconnectTestDb, resetDb } from "../helpers/db";

beforeAll(async () => {
  await connectTestDb();
});
afterAll(async () => {
  await disconnectTestDb();
});
beforeEach(async () => {
  await resetDb();
});

async function makeTeacher(over: Record<string, unknown> = {}) {
  return Teacher.create({
    fullName: "Layla Haddad",
    phone: "+971500000001",
    paymentRate: 100,
    paymentType: "Per Hour",
    ...over,
  });
}

async function makeEnrollment(over: Record<string, unknown> = {}) {
  return Enrollment.create({
    enrollmentId: `E-${Math.floor(Math.random() * 1_000_000)}`,
    fullName: "Aisha Rahman",
    phone: "+971500000002",
    course: "IELTS",
    totalFee: 0,
    amountPaid: 0,
    ...over,
  });
}

async function makeSession(
  teacher: { _id: unknown; fullName: string },
  enrollment: { _id: unknown; fullName: string; course: string },
  over: Record<string, unknown> = {}
) {
  return ClassSession.create({
    enrollmentId: enrollment._id,
    studentName: enrollment.fullName,
    course: enrollment.course,
    teacherId: teacher._id,
    teacherName: teacher.fullName,
    classDate: new Date("2026-08-01"),
    deliveredHours: 2,
    classStatus: "Completed",
    recordedBy: "tester",
    ...over,
  });
}

describe("fallback to the trainer's own rate (existing behaviour)", () => {
  it("pays hours × the trainer rate when the registration sets none", async () => {
    const teacher = await makeTeacher({ paymentRate: 100, paymentType: "Per Hour" });
    const enrollment = await makeEnrollment();
    await makeSession(teacher, enrollment, { deliveredHours: 2 });
    await makeSession(teacher, enrollment, { deliveredHours: 1.5, classDate: new Date("2026-08-02") });

    const p = await previewTeacherPayout(teacher as never);
    expect(p.totalHours).toBe(3.5);
    expect(p.suggestedAmount).toBe(350);
    expect(p.lines[0].source).toBe("teacher");
  });

  it("pays per class when the trainer is on a Per Class basis", async () => {
    const teacher = await makeTeacher({ paymentRate: 150, paymentType: "Per Class" });
    const enrollment = await makeEnrollment();
    await makeSession(teacher, enrollment, { deliveredHours: 2 });
    await makeSession(teacher, enrollment, { deliveredHours: 3, classDate: new Date("2026-08-02") });

    const p = await previewTeacherPayout(teacher as never);
    expect(p.suggestedAmount).toBe(300); // 2 classes, hours irrelevant
  });

  it("flags a trainer with no rate anywhere", async () => {
    const teacher = await makeTeacher({ paymentRate: 0 });
    const enrollment = await makeEnrollment();
    await makeSession(teacher, enrollment);

    const p = await previewTeacherPayout(teacher as never);
    expect(p.suggestedAmount).toBe(0);
    expect(p.note).toMatch(/no pay rate/i);
  });
});

describe("per-registration rates", () => {
  it("uses the registration's rate instead of the trainer's", async () => {
    const teacher = await makeTeacher({ paymentRate: 100, paymentType: "Per Hour" });
    const enrollment = await makeEnrollment({ teacherPayRate: 80, teacherPayBasis: "Per Hour" });
    await makeSession(teacher, enrollment, { deliveredHours: 3 });

    const p = await previewTeacherPayout(teacher as never);
    expect(p.suggestedAmount).toBe(240); // 3h × 80, not × 100
    expect(p.lines[0].source).toBe("enrollment");
    expect(p.lines[0].rate).toBe(80);
  });

  it("sums different rates across courses in one payout", async () => {
    const teacher = await makeTeacher({ paymentRate: 100, paymentType: "Per Hour" });
    const ielts = await makeEnrollment({ course: "IELTS", teacherPayRate: 80, teacherPayBasis: "Per Hour" });
    const sat = await makeEnrollment({
      fullName: "Omar Nasser", course: "SAT", teacherPayRate: 120, teacherPayBasis: "Per Hour",
    });
    await makeSession(teacher, ielts, { deliveredHours: 12 });
    await makeSession(teacher, sat, { deliveredHours: 8, classDate: new Date("2026-08-03") });

    const p = await previewTeacherPayout(teacher as never);
    expect(p.suggestedAmount).toBe(960 + 960);
    expect(p.lines).toHaveLength(2);
    expect(p.mixed).toBe(true);
    const byCourse = Object.fromEntries(p.lines.map((l) => [l.course, l.amount]));
    expect(byCourse).toEqual({ IELTS: 960, SAT: 960 });
  });

  it("mixes a registration rate with the trainer fallback", async () => {
    const teacher = await makeTeacher({ paymentRate: 100, paymentType: "Per Hour" });
    const priced = await makeEnrollment({ course: "SAT", teacherPayRate: 120, teacherPayBasis: "Per Hour" });
    const unpriced = await makeEnrollment({ fullName: "Sara Ali", course: "IELTS" });
    await makeSession(teacher, priced, { deliveredHours: 2 });
    await makeSession(teacher, unpriced, { deliveredHours: 2, classDate: new Date("2026-08-04") });

    const p = await previewTeacherPayout(teacher as never);
    expect(p.suggestedAmount).toBe(240 + 200);
    expect(p.lines.map((l) => l.source).sort()).toEqual(["enrollment", "teacher"]);
  });

  it("honours a Per Class rate set on the registration", async () => {
    const teacher = await makeTeacher({ paymentRate: 100, paymentType: "Per Hour" });
    const enrollment = await makeEnrollment({ teacherPayRate: 200, teacherPayBasis: "Per Class" });
    await makeSession(teacher, enrollment, { deliveredHours: 2 });
    await makeSession(teacher, enrollment, { deliveredHours: 4, classDate: new Date("2026-08-02") });

    const p = await previewTeacherPayout(teacher as never);
    expect(p.suggestedAmount).toBe(400);
  });
});

describe("Fixed for Course", () => {
  it("pays the fixed fee once, however many sessions are in the batch", async () => {
    const teacher = await makeTeacher({ paymentRate: 100, paymentType: "Per Hour" });
    const enrollment = await makeEnrollment({ teacherPayRate: 1500, teacherPayBasis: "Fixed for Course" });
    await makeSession(teacher, enrollment, { deliveredHours: 2 });
    await makeSession(teacher, enrollment, { deliveredHours: 2, classDate: new Date("2026-08-02") });
    await makeSession(teacher, enrollment, { deliveredHours: 2, classDate: new Date("2026-08-03") });

    const p = await previewTeacherPayout(teacher as never);
    expect(p.suggestedAmount).toBe(1500);
    expect(p.lines[0].sessionCount).toBe(3);
  });

  it("does not pay the fixed fee twice when part of the course was already settled", async () => {
    const teacher = await makeTeacher({ paymentRate: 100, paymentType: "Per Hour" });
    const enrollment = await makeEnrollment({ teacherPayRate: 1500, teacherPayBasis: "Fixed for Course" });
    // An earlier settled session for the same registration
    await makeSession(teacher, enrollment, {
      deliveredHours: 2,
      payoutId: new mongoose.Types.ObjectId(),
    });
    await makeSession(teacher, enrollment, { deliveredHours: 2, classDate: new Date("2026-08-05") });

    const p = await previewTeacherPayout(teacher as never);
    expect(p.suggestedAmount).toBe(0);
    expect(p.note).toMatch(/already paid/i);
  });
});

describe("monthly trainers", () => {
  it("pays the monthly rate and ignores per-registration rates", async () => {
    const teacher = await makeTeacher({ paymentRate: 6000, paymentType: "Monthly" });
    const enrollment = await makeEnrollment({ teacherPayRate: 80, teacherPayBasis: "Per Hour" });
    await makeSession(teacher, enrollment, { deliveredHours: 10 });

    const p = await previewTeacherPayout(teacher as never);
    expect(p.suggestedAmount).toBe(6000);
    expect(p.basis).toBe("Monthly");
    expect(p.totalHours).toBe(10); // shown for oversight only
    expect(p.note).toMatch(/monthly/i);
  });
});

describe("which sessions count", () => {
  it("counts Completed and No Show, never Scheduled or Cancelled", async () => {
    const teacher = await makeTeacher({ paymentRate: 100, paymentType: "Per Hour" });
    const enrollment = await makeEnrollment();
    await makeSession(teacher, enrollment, { deliveredHours: 1, classStatus: "Completed" });
    await makeSession(teacher, enrollment, { deliveredHours: 1, classStatus: "No Show", classDate: new Date("2026-08-02") });
    await makeSession(teacher, enrollment, { deliveredHours: 1, classStatus: "Scheduled", classDate: new Date("2026-08-03") });
    await makeSession(teacher, enrollment, { deliveredHours: 1, classStatus: "Cancelled", classDate: new Date("2026-08-04") });

    const p = await previewTeacherPayout(teacher as never);
    expect(p.sessionCount).toBe(2);
    expect(p.suggestedAmount).toBe(200);
  });

  it("excludes sessions already covered by a payout", async () => {
    const teacher = await makeTeacher({ paymentRate: 100, paymentType: "Per Hour" });
    const enrollment = await makeEnrollment();
    await makeSession(teacher, enrollment, { deliveredHours: 5, payoutId: new mongoose.Types.ObjectId() });
    await makeSession(teacher, enrollment, { deliveredHours: 2, classDate: new Date("2026-08-06") });

    const p = await previewTeacherPayout(teacher as never);
    expect(p.sessionCount).toBe(1);
    expect(p.suggestedAmount).toBe(200);
  });

  it("returns an empty preview when nothing is outstanding", async () => {
    const teacher = await makeTeacher();
    const p = await previewTeacherPayout(teacher as never);
    expect(p.sessionCount).toBe(0);
    expect(p.suggestedAmount).toBe(0);
    expect(p.lines).toHaveLength(0);
  });
});
