/**
 * Tests for the central double-entry accounting engine.
 *
 * Covers the invariants the whole accounting module is built on:
 *  - entries always balance to the fils
 *  - only active POSTING accounts can carry transactions
 *  - one active entry per CRM source document
 *  - period lock, draft→post flow, reversal semantics
 *  - Trial Balance / General Ledger derivations exclude reversal pairs
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import {
  createJournalEntry,
  postJournalEntry,
  reverseJournalEntry,
  aggregateBalances,
  getLedger,
  AccountingError,
  type CreateJournalEntryInput,
} from "@/lib/accounting/engine";
import JournalEntry from "@/models/accounting/JournalEntry";
import ChartOfAccount from "@/models/accounting/ChartOfAccount";
import {
  connectTestDb,
  disconnectTestDb,
  resetDb,
  seedCoa,
  configureSettings,
  ACC,
} from "../helpers/db";

beforeAll(async () => {
  await connectTestDb();
});

afterAll(async () => {
  await disconnectTestDb();
});

beforeEach(async () => {
  await resetDb();
  await seedCoa();
});

/** A minimal balanced JV: Dr Cash 100 / Cr Course revenue 100. */
function balancedInput(over: Partial<CreateJournalEntryInput> = {}): CreateJournalEntryInput {
  return {
    date: new Date("2026-08-01"),
    sourceType: "JV",
    description: "Test entry",
    createdBy: "tester",
    lines: [
      { accountCode: ACC.cash, debit: 100 },
      { accountCode: ACC.revenue, credit: 100 },
    ],
    ...over,
  };
}

describe("createJournalEntry — validation", () => {
  it("rejects an entry with fewer than two lines", async () => {
    await expect(
      createJournalEntry(balancedInput({ lines: [{ accountCode: ACC.cash, debit: 100 }] }))
    ).rejects.toThrow(AccountingError);
  });

  it("rejects an unbalanced entry", async () => {
    await expect(
      createJournalEntry(
        balancedInput({
          lines: [
            { accountCode: ACC.cash, debit: 100 },
            { accountCode: ACC.revenue, credit: 99.99 },
          ],
        })
      )
    ).rejects.toThrow(/not balanced/);
  });

  it("rejects a line carrying both a debit and a credit", async () => {
    await expect(
      createJournalEntry(
        balancedInput({
          lines: [
            { accountCode: ACC.cash, debit: 100, credit: 10 },
            { accountCode: ACC.revenue, credit: 90 },
          ],
        })
      )
    ).rejects.toThrow(/both debit and credit/);
  });

  it("rejects negative amounts", async () => {
    await expect(
      createJournalEntry(
        balancedInput({
          lines: [
            { accountCode: ACC.cash, debit: -100 },
            { accountCode: ACC.revenue, credit: -100 },
          ],
        })
      )
    ).rejects.toThrow(/Negative amounts/);
  });

  it("rejects a line with no amount", async () => {
    await expect(
      createJournalEntry(
        balancedInput({
          lines: [
            { accountCode: ACC.cash, debit: 100 },
            { accountCode: ACC.expenseMisc },
            { accountCode: ACC.revenue, credit: 100 },
          ],
        })
      )
    ).rejects.toThrow(/no amount/);
  });

  it("rejects an account that is not in the Chart of Accounts", async () => {
    await expect(
      createJournalEntry(
        balancedInput({
          lines: [
            { accountCode: "9999999999", debit: 100 },
            { accountCode: ACC.revenue, credit: 100 },
          ],
        })
      )
    ).rejects.toThrow(/does not exist/);
  });

  it("rejects posting to a parent (non-posting) account", async () => {
    await expect(
      createJournalEntry(
        balancedInput({
          lines: [
            { accountCode: ACC.arParent, debit: 100 },
            { accountCode: ACC.revenue, credit: 100 },
          ],
        })
      )
    ).rejects.toThrow(/parent account/);
  });

  it("rejects posting to an inactive account", async () => {
    await ChartOfAccount.updateOne({ code: ACC.cash }, { isActive: false });
    await expect(createJournalEntry(balancedInput())).rejects.toThrow(/inactive/);
  });
});

describe("createJournalEntry — creation", () => {
  it("creates a Posted, balanced entry with sequential JV numbers", async () => {
    const first = await createJournalEntry(balancedInput());
    const second = await createJournalEntry(balancedInput());

    expect(first.jvNumber).toBe("JV-000001");
    expect(second.jvNumber).toBe("JV-000002");
    expect(first.status).toBe("Posted");
    expect(first.totalDebit).toBe(100);
    expect(first.totalCredit).toBe(100);
    expect(first.postedBy).toBe("tester");
    expect(first.postedAt).toBeInstanceOf(Date);
    // Account names are resolved from the COA, never trusted from input
    expect(first.lines[0].accountName).toBe("Cash In hand");
    expect(first.lines[1].accountName).toBe("Course 1");
  });

  it("preserves line metadata (student/supplier/course refs)", async () => {
    const entry = await createJournalEntry(
      balancedInput({
        lines: [
          { accountCode: ACC.cash, debit: 100, studentRef: "Aisha", courseRef: "IELTS" },
          { accountCode: ACC.revenue, credit: 100, studentRef: "Aisha", courseRef: "IELTS" },
        ],
      })
    );
    expect(entry.lines[0].studentRef).toBe("Aisha");
    expect(entry.lines[1].courseRef).toBe("IELTS");
  });

  it("is safe against floating-point drift (0.1 + 0.2 balances 0.3)", async () => {
    const entry = await createJournalEntry(
      balancedInput({
        lines: [
          { accountCode: ACC.cash, debit: 0.1 },
          { accountCode: ACC.bank, debit: 0.2 },
          { accountCode: ACC.revenue, credit: 0.3 },
        ],
      })
    );
    expect(entry.totalDebit).toBe(0.3);
    expect(entry.totalCredit).toBe(0.3);
  });

  it("saves a Draft when autoPost is false", async () => {
    const entry = await createJournalEntry(balancedInput({ autoPost: false }));
    expect(entry.status).toBe("Draft");
    expect(entry.postedBy).toBeUndefined();
    expect(entry.postedAt).toBeUndefined();
  });
});

describe("period lock", () => {
  it("blocks posting on or before the lock date and allows after it", async () => {
    await configureSettings({ lockDate: new Date("2026-07-31") } as never);

    await expect(
      createJournalEntry(balancedInput({ date: new Date("2026-07-31") }))
    ).rejects.toThrow(/locked/);
    await expect(
      createJournalEntry(balancedInput({ date: new Date("2026-06-15") }))
    ).rejects.toThrow(/locked/);

    const after = await createJournalEntry(balancedInput({ date: new Date("2026-08-01") }));
    expect(after.status).toBe("Posted");
  });
});

describe("duplicate-source guard", () => {
  it("allows only one active entry per (sourceType, sourceId)", async () => {
    await createJournalEntry(
      balancedInput({ sourceType: "Receipt", sourceId: "pay-1", sourceNumber: "P-001" })
    );
    await expect(
      createJournalEntry(
        balancedInput({ sourceType: "Receipt", sourceId: "pay-1", sourceNumber: "P-001" })
      )
    ).rejects.toThrow(/already exists/);
  });

  it("allows a repost for the same source after the original is reversed", async () => {
    const original = await createJournalEntry(
      balancedInput({ sourceType: "Receipt", sourceId: "pay-1" })
    );
    await reverseJournalEntry(String(original._id), "tester", "amount corrected");

    const repost = await createJournalEntry(
      balancedInput({ sourceType: "Receipt", sourceId: "pay-1" })
    );
    expect(repost.status).toBe("Posted");
  });
});

describe("postJournalEntry", () => {
  it("posts a Draft entry", async () => {
    const draft = await createJournalEntry(balancedInput({ autoPost: false }));
    const posted = await postJournalEntry(String(draft._id), "approver");
    expect(posted.status).toBe("Posted");
    expect(posted.postedBy).toBe("approver");
    expect(posted.postedAt).toBeInstanceOf(Date);
  });

  it("refuses to post an entry that is not a Draft", async () => {
    const entry = await createJournalEntry(balancedInput());
    await expect(postJournalEntry(String(entry._id), "approver")).rejects.toThrow(
      /Only Draft entries/
    );
  });
});

describe("reverseJournalEntry", () => {
  it("creates a linked opposite entry and marks the original Reversed", async () => {
    const original = await createJournalEntry(balancedInput());
    const reversal = await reverseJournalEntry(String(original._id), "tester", "typo");

    // Sides flipped, totals flipped
    expect(reversal.lines[0].accountCode).toBe(ACC.cash);
    expect(reversal.lines[0].debit).toBe(0);
    expect(reversal.lines[0].credit).toBe(100);
    expect(reversal.lines[1].debit).toBe(100);
    expect(reversal.totalDebit).toBe(100);
    expect(reversal.totalCredit).toBe(100);
    expect(reversal.sourceType).toBe("Reversal");
    expect(reversal.status).toBe("Posted");
    expect(String(reversal.reversesEntryId)).toBe(String(original._id));

    const reloaded = await JournalEntry.findById(original._id);
    expect(reloaded!.status).toBe("Reversed");
    expect(String(reloaded!.reversedByEntryId)).toBe(String(reversal._id));
  });

  it("refuses to reverse the same entry twice", async () => {
    const original = await createJournalEntry(balancedInput());
    await reverseJournalEntry(String(original._id), "tester");
    // After the first reversal the original is Reversed, not Posted
    await expect(reverseJournalEntry(String(original._id), "tester")).rejects.toThrow(
      /Only Posted entries/
    );
  });

  it("refuses to reverse a Draft", async () => {
    const draft = await createJournalEntry(balancedInput({ autoPost: false }));
    await expect(reverseJournalEntry(String(draft._id), "tester")).rejects.toThrow(
      /Only Posted entries/
    );
  });
});

describe("aggregateBalances (Trial Balance source)", () => {
  it("sums posted debits/credits per account", async () => {
    await createJournalEntry(balancedInput()); // Dr cash 100 / Cr revenue 100
    await createJournalEntry(
      balancedInput({
        lines: [
          { accountCode: ACC.cash, debit: 50.25 },
          { accountCode: ACC.revenue, credit: 50.25 },
        ],
      })
    );

    const rows = await aggregateBalances();
    const cash = rows.find((r) => r.accountCode === ACC.cash);
    const revenue = rows.find((r) => r.accountCode === ACC.revenue);
    expect(cash).toMatchObject({ periodDebit: 150.25, periodCredit: 0 });
    expect(revenue).toMatchObject({ periodDebit: 0, periodCredit: 150.25 });

    // Debits always equal credits across the whole trial balance
    const totalDebit = rows.reduce((s, r) => s + r.periodDebit, 0);
    const totalCredit = rows.reduce((s, r) => s + r.periodCredit, 0);
    expect(totalDebit).toBeCloseTo(totalCredit, 2);
  });

  it("excludes reversed entries and their reversals (nets to zero)", async () => {
    const keep = await createJournalEntry(balancedInput());
    const gone = await createJournalEntry(
      balancedInput({
        lines: [
          { accountCode: ACC.bank, debit: 500 },
          { accountCode: ACC.revenue, credit: 500 },
        ],
      })
    );
    await reverseJournalEntry(String(gone._id), "tester");

    const rows = await aggregateBalances();
    expect(rows.find((r) => r.accountCode === ACC.bank)).toBeUndefined();
    expect(rows.find((r) => r.accountCode === ACC.cash)).toMatchObject({
      periodDebit: keep.totalDebit,
    });
    expect(rows.find((r) => r.accountCode === ACC.revenue)).toMatchObject({
      periodCredit: 100,
    });
  });

  it("filters by date window", async () => {
    await createJournalEntry(balancedInput({ date: new Date("2026-01-15") }));
    await createJournalEntry(
      balancedInput({
        date: new Date("2026-06-15"),
        lines: [
          { accountCode: ACC.cash, debit: 40 },
          { accountCode: ACC.revenue, credit: 40 },
        ],
      })
    );

    const rows = await aggregateBalances(new Date("2026-06-01"), new Date("2026-06-30"));
    expect(rows.find((r) => r.accountCode === ACC.cash)).toMatchObject({ periodDebit: 40 });
  });
});

describe("getLedger (General Ledger)", () => {
  it("returns rows with a correct running balance", async () => {
    await createJournalEntry(balancedInput({ date: new Date("2026-08-01") }));
    await createJournalEntry(
      balancedInput({
        date: new Date("2026-08-02"),
        lines: [
          { accountCode: ACC.expenseMisc, debit: 30 },
          { accountCode: ACC.cash, credit: 30 },
        ],
      })
    );

    const rows = await getLedger({ accountCode: ACC.cash });
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ debit: 100, credit: 0, balance: 100 });
    expect(rows[1]).toMatchObject({ debit: 0, credit: 30, balance: 70 });
  });

  it("hides reversal pairs by default and shows them with includeReversed", async () => {
    const original = await createJournalEntry(balancedInput());
    await reverseJournalEntry(String(original._id), "tester");

    const active = await getLedger({ accountCode: ACC.cash });
    expect(active).toHaveLength(0);

    const audit = await getLedger({ accountCode: ACC.cash, includeReversed: true });
    expect(audit).toHaveLength(2);
    // The pair nets to zero
    expect(audit[audit.length - 1].balance).toBe(0);
  });
});
