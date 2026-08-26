/**
 * Multi-trainer registrations.
 *
 * A student can be taught by several trainers. `teacherIds` is the full list
 * and `teacherId` mirrors the first (the primary) so payroll, class sessions
 * and every pre-existing query keep working untouched.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import mongoose from "mongoose";
import Enrollment from "@/models/Enrollment";
import { taughtByFilter, applyTaughtBy, isTaughtBy, resolveTeacherAssignment } from "@/lib/teacher";
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

const A = new mongoose.Types.ObjectId();
const B = new mongoose.Types.ObjectId();
const C = new mongoose.Types.ObjectId();

async function makeEnrollment(over: Record<string, unknown> = {}) {
  return Enrollment.create({
    enrollmentId: `E-${Math.floor(Math.random() * 1_000_000)}`,
    fullName: "Aisha Rahman",
    phone: "+971500000000",
    course: "IELTS",
    totalFee: 0,
    amountPaid: 0,
    ...over,
  });
}

describe("taughtByFilter", () => {
  it("finds registrations where the trainer is primary or co-teaching", async () => {
    await makeEnrollment({ fullName: "Primary only", teacherId: A, teacherIds: [A] });
    await makeEnrollment({ fullName: "Co-taught", teacherId: B, teacherIds: [B, A] });
    await makeEnrollment({ fullName: "Someone else", teacherId: C, teacherIds: [C] });

    const mine = await Enrollment.find(taughtByFilter(A)).lean();
    expect(mine.map((e) => e.fullName).sort()).toEqual(["Co-taught", "Primary only"]);
  });

  it("still matches records written before multi-trainer support", async () => {
    // Legacy shape: scalar teacherId, no teacherIds array
    await Enrollment.collection.insertOne({
      enrollmentId: "E-LEGACY",
      fullName: "Legacy Student",
      phone: "+971500000001",
      course: "SAT",
      totalFee: 0,
      amountPaid: 0,
      teacherId: A,
    });
    const mine = await Enrollment.find(taughtByFilter(A)).lean();
    expect(mine).toHaveLength(1);
    expect(mine[0].fullName).toBe("Legacy Student");
  });
});

describe("applyTaughtBy", () => {
  it("never clobbers an existing $or search filter", async () => {
    await makeEnrollment({ fullName: "Zainab Ali", teacherIds: [A], teacherId: A });
    await makeEnrollment({ fullName: "Zainab Other", teacherIds: [C], teacherId: C });
    await makeEnrollment({ fullName: "Different Name", teacherIds: [A], teacherId: A });

    // Mirrors the enrollments API: text search via $or, then trainer scoping
    const query: Record<string, unknown> = {
      $or: [{ fullName: /Zainab/i }, { phone: /Zainab/i }],
    };
    applyTaughtBy(query, A);

    const rows = await Enrollment.find(query).lean();
    // Only the record matching BOTH the search and the trainer
    expect(rows.map((r) => r.fullName)).toEqual(["Zainab Ali"]);
    expect(query.$or).toBeDefined();
  });

  it("stacks with an existing $and", () => {
    const query: Record<string, unknown> = { $and: [{ status: "Active" }] };
    applyTaughtBy(query, A);
    expect((query.$and as unknown[]).length).toBe(2);
  });
});

describe("isTaughtBy", () => {
  it("accepts primary and co-teaching trainers, rejects others", () => {
    const e = { teacherId: B, teacherIds: [B, A] };
    expect(isTaughtBy(e, B)).toBe(true);
    expect(isTaughtBy(e, A)).toBe(true);
    expect(isTaughtBy(e, C)).toBe(false);
    expect(isTaughtBy(null, A)).toBe(false);
  });

  it("accepts a legacy record with only the scalar field", () => {
    expect(isTaughtBy({ teacherId: A }, A)).toBe(true);
    expect(isTaughtBy({ teacherId: A }, B)).toBe(false);
  });
});

describe("resolveTeacherAssignment", () => {
  const names: Record<string, string> = { [String(A)]: "Layla", [String(B)]: "Omar" };
  const nameOf = (id: string) => names[id];

  it("mirrors the first trainer into the primary scalar", () => {
    const r = resolveTeacherAssignment([String(A), String(B)], nameOf);
    expect(r.teacherId).toBe(String(A));
    expect(r.teacherName).toBe("Layla");
    expect(r.teacherIds).toEqual([String(A), String(B)]);
    expect(r.teacherNames).toEqual(["Layla", "Omar"]);
  });

  it("de-duplicates and clears cleanly", () => {
    expect(resolveTeacherAssignment([String(A), String(A)], nameOf).teacherIds).toEqual([String(A)]);
    const empty = resolveTeacherAssignment([], nameOf);
    expect(empty.teacherId).toBeUndefined();
    expect(empty.teacherIds).toEqual([]);
  });
});
