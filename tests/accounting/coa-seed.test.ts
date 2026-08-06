/**
 * Structural integrity checks for the official Chart of Accounts seed.
 * Pure data tests — no database needed.
 */
import { describe, it, expect } from "vitest";
import { COA_SEED } from "@/lib/accounting/coa-seed";

const byCode = new Map(COA_SEED.map((a) => [a.code, a]));

describe("COA seed integrity", () => {
  it("has unique account codes", () => {
    expect(byCode.size).toBe(COA_SEED.length);
  });

  it("every parentCode refers to an existing account", () => {
    for (const a of COA_SEED) {
      if (a.parentCode === null) continue;
      expect(byCode.has(a.parentCode), `${a.code} → missing parent ${a.parentCode}`).toBe(true);
    }
  });

  it("no account posts under a posting parent (postings go to leaves only)", () => {
    for (const a of COA_SEED) {
      if (a.parentCode === null) continue;
      const parent = byCode.get(a.parentCode)!;
      expect(parent.isPosting, `${a.code} has POSTING parent ${parent.code}`).toBe(false);
    }
  });

  it("children carry the same account type as their parent", () => {
    for (const a of COA_SEED) {
      if (a.parentCode === null) continue;
      const parent = byCode.get(a.parentCode)!;
      expect(a.type, `${a.code} type differs from parent ${parent.code}`).toBe(parent.type);
    }
  });

  it("contains every account the default AccountingSettings resolve to", () => {
    // Defaults from models/accounting/AccountingSettings.ts — these must exist
    // as ACTIVE POSTING accounts or auto-posting would fail on a fresh install.
    const defaults = [
      "1010100001", // defaultCashAccount
      "1010200001", // defaultBankAccount
      "1010100002", // defaultPosAccount
      "1010100003", // tabbyAccount
      "1010100004", // tamaraAccount
      "1010100005", // pettyCashAccount
      "1010300001", // accountsReceivable control
      "2030100001", // feesAdvanceAccount
      "2030100003", // outputVatAccount
      "2030100002", // inputVatAccount
      "4010010001", // defaultRevenueAccount
      "5010010017", // defaultExpenseAccount
      "5010010038", // teacherSalaryAccount
    ];
    for (const code of defaults) {
      const acc = byCode.get(code);
      expect(acc, `settings default ${code} missing from COA seed`).toBeDefined();
      expect(acc!.isPosting, `settings default ${code} must be a posting account`).toBe(true);
    }
    // Parent/control codes referenced by settings must exist but NOT be posting
    expect(byCode.get("20102")?.isPosting, "accountsPayable parent 20102").toBe(false);
    expect(byCode.get("10103")?.isPosting, "receivables parent 10103").toBe(false);
  });
});
