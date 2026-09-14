/**
 * Accounting engine guarantees under concurrency and period locks.
 *
 * engine.test.ts covers the single-request rules. These cover what happens
 * when two requests race (double-clicks, two tabs, a backfill running while
 * staff work) and when the books are locked after a draft or entry exists —
 * the gaps the audit found in the original read-then-write implementation.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import {
  createJournalEntry, postJournalEntry, reverseJournalEntry, preflightJournalEntry,
  validateJournalLines, AccountingError, type CreateJournalEntryInput,
} from "@/lib/accounting/engine";
import { ensureStudentArAccount, syncSourceEntry } from "@/lib/accounting/postings";
import JournalEntry from "@/models/accounting/JournalEntry";
import ChartOfAccount from "@/models/accounting/ChartOfAccount";
import Enrollment from "@/models/Enrollment";
import { connectTestDb, disconnectTestDb, resetDb, seedCoa, configureSettings, ACC } from "../helpers/db";

beforeAll(async () => {
  await connectTestDb();
  await JournalEntry.init();
});
afterAll(async () => {
  await disconnectTestDb();
});
beforeEach(async () => {
  await resetDb();
  await seedCoa();
  await configureSettings({});
});

const entry = (over: Partial<CreateJournalEntryInput> = {}): CreateJournalEntryInput => ({
  date: new Date("2026-08-01"),
  sourceType: "Receipt",
  sourceId: "payment-1",
  description: "Receipt",
  createdBy: "tester",
  lines: [
    { accountCode: ACC.cash, debit: 100 },
    { accountCode: ACC.feesAdvance, credit: 100 },
  ],
  ...over,
});

describe("one posted entry per source document — even under a race", () => {
  it("two concurrent postings for the same payment produce exactly one entry", async () => {
    const results = await Promise.allSettled([createJournalEntry(entry()), createJournalEntry(entry())]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect(rejected.reason).toBeInstanceOf(AccountingError);
    expect(await JournalEntry.countDocuments({ sourceId: "payment-1", status: "Posted" })).toBe(1);
  });

  it("a reversed entry can still be re-posted for the same document", async () => {
    const first = await createJournalEntry(entry());
    await reverseJournalEntry(String(first._id), "tester");
    const again = await createJournalEntry(entry({ lines: [
      { accountCode: ACC.cash, debit: 120 },
      { accountCode: ACC.feesAdvance, credit: 120 },
    ] }));
    expect(again.totalDebit).toBe(120);
  });
});

describe("reversal", () => {
  it("two simultaneous reversals create one reversal, not two", async () => {
    const e = await createJournalEntry(entry());
    const results = await Promise.allSettled([
      reverseJournalEntry(String(e._id), "a"),
      reverseJournalEntry(String(e._id), "b"),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await JournalEntry.countDocuments({ sourceType: "Reversal" })).toBe(1);
    const original = await JournalEntry.findById(e._id).lean();
    expect(original!.status).toBe("Reversed");
    expect(original!.reversedByEntryId).toBeTruthy();
  });

  it("an entry dated in a locked period cannot be reversed — reports would change after the fact", async () => {
    const e = await createJournalEntry(entry({ date: new Date("2026-06-15") }));
    await configureSettings({ lockDate: new Date("2026-06-30") });
    await expect(reverseJournalEntry(String(e._id), "tester")).rejects.toThrow(/locked/);
    expect((await JournalEntry.findById(e._id).lean())!.status).toBe("Posted");
    expect(await JournalEntry.countDocuments({ sourceType: "Reversal" })).toBe(0);
  });
});

describe("posting a draft re-validates everything", () => {
  it("refuses a draft whose date fell inside the lock after it was saved", async () => {
    const draft = await createJournalEntry(entry({ sourceId: undefined, sourceType: "JV", autoPost: false }));
    await configureSettings({ lockDate: new Date("2026-08-31") });
    await expect(postJournalEntry(String(draft._id), "tester")).rejects.toThrow(/locked/);
    expect((await JournalEntry.findById(draft._id).lean())!.status).toBe("Draft");
  });

  it("refuses a draft that uses an account deactivated since", async () => {
    const draft = await createJournalEntry(entry({ sourceId: undefined, sourceType: "JV", autoPost: false }));
    await ChartOfAccount.updateOne({ code: ACC.feesAdvance }, { $set: { isActive: false } });
    await expect(postJournalEntry(String(draft._id), "tester")).rejects.toThrow(/inactive/);
  });

  it("a double-clicked Post posts once", async () => {
    const draft = await createJournalEntry(entry({ sourceId: undefined, sourceType: "JV", autoPost: false }));
    const results = await Promise.allSettled([
      postJournalEntry(String(draft._id), "a"),
      postJournalEntry(String(draft._id), "b"),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  });
});

describe("amount validation", () => {
  it("rejects Infinity, which used to balance against itself", () => {
    expect(() =>
      validateJournalLines([
        { accountCode: ACC.cash, debit: Infinity },
        { accountCode: ACC.revenue, credit: Infinity },
      ])
    ).toThrow(AccountingError);
  });

  it("rejects an invalid date", async () => {
    await expect(createJournalEntry(entry({ date: "31/12/2026" }))).rejects.toThrow(/valid date/);
  });
});

describe("preflight and syncSourceEntry", () => {
  it("preflight writes nothing", async () => {
    await preflightJournalEntry(entry());
    expect(await JournalEntry.countDocuments({})).toBe(0);
  });

  it("when the replacement entry would be refused, the document change never runs", async () => {
    const original = await createJournalEntry(entry({ date: new Date("2026-08-01") }));
    await configureSettings({ lockDate: new Date("2026-08-31") });
    let applied = false;
    await expect(
      syncSourceEntry({
        sourceTypes: ["Receipt"],
        sourceId: "payment-1",
        plan: entry({ date: new Date("2026-08-02") }),
        affectsLedger: true,
        actor: "tester",
        reason: "edit",
        applyChange: async () => { applied = true; },
      })
    ).rejects.toThrow(/locked/);
    expect(applied).toBe(false);
    expect((await JournalEntry.findById(original._id).lean())!.status).toBe("Posted");
  });

  it("edit: reverses the old entry and posts exactly one replacement", async () => {
    await createJournalEntry(entry());
    const res = await syncSourceEntry({
      sourceTypes: ["Receipt"],
      sourceId: "payment-1",
      plan: entry({ lines: [{ accountCode: ACC.cash, debit: 250 }, { accountCode: ACC.feesAdvance, credit: 250 }] }),
      affectsLedger: true,
      actor: "tester",
      reason: "edit",
      applyChange: async () => "changed",
    });
    expect(res.result).toBe("changed");
    expect(res.reversed).not.toBeNull();
    const active = await JournalEntry.find({ sourceId: "payment-1", status: "Posted" }).lean();
    expect(active).toHaveLength(1);
    expect(active[0].totalDebit).toBe(250);
  });
});

describe("student receivable account", () => {
  it("two postings at the same moment share ONE account for the student", async () => {
    const e = await Enrollment.create({
      enrollmentId: "E-9", fullName: "Omar Saleh", phone: "+971500000009", course: "IELTS", totalFee: 0, amountPaid: 0,
    });
    const codes = await Promise.all([ensureStudentArAccount(String(e._id)), ensureStudentArAccount(String(e._id))]);
    expect(codes[0]).toBe(codes[1]);
    expect(await ChartOfAccount.countDocuments({ parentCode: "10103", isSystem: false })).toBe(1);
    expect((await Enrollment.findById(e._id).lean())!.arAccountCode).toBe(codes[0]);
  });
});
