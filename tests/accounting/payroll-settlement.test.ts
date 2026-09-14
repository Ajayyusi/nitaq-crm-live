/**
 * Settling a trainer payout — the guards that stop the same work being paid twice.
 *
 * previewTeacherPayout (payroll.test.ts) decides WHAT is owed. These tests
 * cover settleTeacherPayout, which RECORDS it: sessions are claimed atomically,
 * nothing is written when the ledger would refuse the entry, a monthly salary
 * is paid once per month, and a paid fixed course fee can't be re-triggered by
 * changing the registration's pay basis.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import {
  settleTeacherPayout,
  previewTeacherPayout,
  payRateChangeBlockedReason,
  businessMonthKey,
  PayrollError,
} from "@/lib/payroll";
import { AccountingError } from "@/lib/accounting/engine";
import Teacher from "@/models/Teacher";
import Enrollment from "@/models/Enrollment";
import ClassSession from "@/models/ClassSession";
import TeacherPayout from "@/models/TeacherPayout";
import JournalEntry from "@/models/accounting/JournalEntry";
import {
  connectTestDb, disconnectTestDb, resetDb, seedCoa, configureSettings, ACC,
} from "../helpers/db";

beforeAll(async () => {
  await connectTestDb();
  // Unique indexes back the concurrency guarantees — make sure they exist.
  await Promise.all([TeacherPayout.init(), JournalEntry.init(), ClassSession.init()]);
});
afterAll(async () => {
  await disconnectTestDb();
});
beforeEach(async () => {
  await resetDb();
  await seedCoa();
  await configureSettings({ defaultCashAccount: ACC.cash, teacherSalaryAccount: ACC.teacherSalary });
});

async function makeTeacher(over: Record<string, unknown> = {}) {
  return Teacher.create({ fullName: "Layla Haddad", phone: "+971500000001", paymentRate: 100, paymentType: "Per Hour", ...over });
}

async function makeEnrollment(over: Record<string, unknown> = {}) {
  return Enrollment.create({
    enrollmentId: `E-${Math.floor(Math.random() * 1_000_000)}`,
    fullName: "Aisha Rahman", phone: "+971500000002", course: "IELTS", totalFee: 0, amountPaid: 0,
    ...over,
  });
}

async function makeSession(
  teacher: { _id: unknown; fullName: string },
  enrollment: { _id: unknown; fullName: string; course: string },
  over: Record<string, unknown> = {}
) {
  return ClassSession.create({
    enrollmentId: enrollment._id, studentName: enrollment.fullName, course: enrollment.course,
    teacherId: teacher._id, teacherName: teacher.fullName,
    classDate: new Date("2026-08-01"), deliveredHours: 2, classStatus: "Completed", recordedBy: "tester",
    ...over,
  });
}

const settle = (teacherId: string, over: Record<string, unknown> = {}) =>
  settleTeacherPayout({ teacherId, amount: 200, paidDate: "2026-08-10", createdBy: "tester", ...over });

describe("settleTeacherPayout — happy path", () => {
  it("records the payout, stamps every session, and posts Dr salary / Cr cash", async () => {
    const t = await makeTeacher();
    const e = await makeEnrollment();
    await makeSession(t, e);

    const { payout, entry } = await settle(String(t._id));

    expect(payout.amount).toBe(200);
    expect(await ClassSession.countDocuments({ payoutId: payout._id })).toBe(1);
    expect(entry.status).toBe("Posted");
    expect(entry.lines.find((l) => l.accountCode === ACC.teacherSalary)?.debit).toBe(200);
    expect(entry.lines.find((l) => l.accountCode === ACC.cash)?.credit).toBe(200);
    expect((await previewTeacherPayout(t as never)).sessionCount).toBe(0);
  });
});

describe("double payment — concurrent submits", () => {
  it("two simultaneous Mark Paid clicks pay the work exactly once", async () => {
    const t = await makeTeacher();
    const e = await makeEnrollment();
    await makeSession(t, e, { deliveredHours: 5 });

    const results = await Promise.allSettled([
      settle(String(t._id), { amount: 500 }),
      settle(String(t._id), { amount: 500 }),
    ]);

    const ok = results.filter((r) => r.status === "fulfilled");
    const failed = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];
    expect(ok).toHaveLength(1);
    expect(failed).toHaveLength(1);
    expect(failed[0].reason).toBeInstanceOf(PayrollError);

    // Exactly one payout and one salary posting survive — no orphans from the loser.
    expect(await TeacherPayout.countDocuments({})).toBe(1);
    expect(await JournalEntry.countDocuments({ sourceType: "Expense", status: "Posted" })).toBe(1);
  });
});

describe("validation happens before anything is written", () => {
  it("rejects a non-finite amount", async () => {
    const t = await makeTeacher();
    await makeSession(t, await makeEnrollment());
    await expect(settle(String(t._id), { amount: "Infinity" })).rejects.toThrow(PayrollError);
    expect(await TeacherPayout.countDocuments({})).toBe(0);
  });

  it("refuses a payout dated in a locked period and leaves sessions unpaid", async () => {
    await configureSettings({
      defaultCashAccount: ACC.cash, teacherSalaryAccount: ACC.teacherSalary, lockDate: new Date("2026-08-31"),
    });
    const t = await makeTeacher();
    await makeSession(t, await makeEnrollment());

    await expect(settle(String(t._id), { paidDate: "2026-08-15" })).rejects.toThrow(AccountingError);
    expect(await TeacherPayout.countDocuments({})).toBe(0);
    expect(await ClassSession.countDocuments({ payoutId: { $ne: null } })).toBe(0);
  });

  it("refuses to pay a trainer from a receivable account", async () => {
    const t = await makeTeacher();
    await makeSession(t, await makeEnrollment());
    await expect(settle(String(t._id), { paymentAccountCode: ACC.arControl })).rejects.toThrow(/cannot be used/);
    expect(await ClassSession.countDocuments({ payoutId: { $ne: null } })).toBe(0);
  });

  it("requires a reason when the amount differs from the calculation", async () => {
    const t = await makeTeacher();
    await makeSession(t, await makeEnrollment());
    await expect(settle(String(t._id), { amount: 350 })).rejects.toThrow(/reason is required/);
    const ok = await settle(String(t._id), { amount: 350, adjustmentReason: "bonus for extra prep" });
    expect(ok.payout.adjustmentReason).toBe("bonus for extra prep");
  });
});

describe("monthly salary — one payment per month", () => {
  it("refuses a second salary for the same month, allows the next month", async () => {
    const t = await makeTeacher({ paymentType: "Monthly", paymentRate: 6000 });

    await settle(String(t._id), { amount: 6000, periodMonth: "2026-08" });
    await expect(settle(String(t._id), { amount: 6000, periodMonth: "2026-08" })).rejects.toMatchObject({ status: 409 });

    const next = await settle(String(t._id), { amount: 6000, periodMonth: "2026-09", paidDate: "2026-09-30" });
    expect(next.payout.periodKey).toBe("2026-09");
    expect(await TeacherPayout.countDocuments({})).toBe(2);
  });

  it("concurrent salary submits for one month record it once", async () => {
    const t = await makeTeacher({ paymentType: "Monthly", paymentRate: 6000 });
    const results = await Promise.allSettled([
      settle(String(t._id), { amount: 6000, periodMonth: "2026-08" }),
      settle(String(t._id), { amount: 6000, periodMonth: "2026-08" }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await TeacherPayout.countDocuments({ periodKey: "2026-08" })).toBe(1);
  });

  it("defaults the salary month to the UAE calendar month, not UTC", () => {
    // 21:30 UTC on 30 Sep is 01:30 on 1 Oct in Dubai
    expect(businessMonthKey(new Date("2026-09-30T21:30:00Z"))).toBe("2026-10");
    expect(businessMonthKey(new Date("2026-09-30T19:59:00Z"))).toBe("2026-09");
  });
});

describe("fixed course fee — rate/basis lock after settlement", () => {
  it("blocks switching a paid fixed-fee registration to hourly", async () => {
    const t = await makeTeacher();
    const e = await makeEnrollment({ teacherPayRate: 1500, teacherPayBasis: "Fixed for Course" });
    await makeSession(t, e);
    await settle(String(t._id), { amount: 1500 });

    const reason = await payRateChangeBlockedReason(
      String(e._id),
      { teacherPayRate: 1500, teacherPayBasis: "Fixed for Course" },
      { teacherPayRate: 80, teacherPayBasis: "Per Hour" }
    );
    expect(reason).toMatch(/fixed course fee/);
  });

  it("allows an hourly rate change on a registration that was paid hourly", async () => {
    const t = await makeTeacher();
    const e = await makeEnrollment({ teacherPayRate: 100, teacherPayBasis: "Per Hour" });
    await makeSession(t, e);
    await settle(String(t._id), { amount: 200 });

    expect(
      await payRateChangeBlockedReason(
        String(e._id),
        { teacherPayRate: 100, teacherPayBasis: "Per Hour" },
        { teacherPayRate: 120, teacherPayBasis: "Per Hour" }
      )
    ).toBeNull();
  });

  it("does not block anything before a payout exists", async () => {
    const t = await makeTeacher();
    const e = await makeEnrollment({ teacherPayRate: 1500, teacherPayBasis: "Fixed for Course" });
    await makeSession(t, e);
    expect(
      await payRateChangeBlockedReason(
        String(e._id),
        { teacherPayRate: 1500, teacherPayBasis: "Fixed for Course" },
        { teacherPayRate: 80, teacherPayBasis: "Per Hour" }
      )
    ).toBeNull();
  });
});
