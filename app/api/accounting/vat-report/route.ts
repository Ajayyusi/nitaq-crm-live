import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import JournalEntry from "@/models/accounting/JournalEntry";
import { getAccountingSettings } from "@/models/accounting/AccountingSettings";
import { requireAuth } from "@/lib/api-auth";
import { buildDateFilter } from "@/lib/dateRange";

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * VAT report — derived from posted journal lines on the configured
 * Input VAT / Output VAT accounts, so it always agrees with the ledger.
 */
export async function GET(request: NextRequest) {
  const authed = await requireAuth(["admin", "accountant", "manager"]);
  if (authed instanceof NextResponse) return authed;

  await connectDB();
  const settings = await getAccountingSettings();
  const { searchParams } = new URL(request.url);
  const dateFilter = buildDateFilter(searchParams.get("from") ?? undefined, searchParams.get("to") ?? undefined);

  const vatCodes = [settings.inputVatAccount, settings.outputVatAccount];
  const match: Record<string, unknown> = {
    status: { $in: ["Posted", "Reversed"] },
    "lines.accountCode": { $in: vatCodes },
  };
  if (dateFilter) match.date = dateFilter;

  const entries = await JournalEntry.find(match).sort({ date: 1 }).lean();

  let outputVat = 0;
  let inputVat = 0;
  const transactions: {
    date: string; jvNumber: string; sourceType: string; sourceNumber: string;
    description: string; party: string; kind: "Output" | "Input";
    taxableAmount: number; vatAmount: number; totalAmount: number;
  }[] = [];

  for (const e of entries) {
    for (const l of e.lines) {
      if (l.accountCode === settings.outputVatAccount) {
        const vat = round2(l.credit - l.debit); // credits increase Output VAT liability
        outputVat = round2(outputVat + vat);
        const taxable = round2(e.lines
          .filter((x) => x.accountCode !== settings.outputVatAccount && x.credit > 0)
          .reduce((s, x) => s + x.credit, 0));
        transactions.push({
          date: e.date.toISOString().slice(0, 10), jvNumber: e.jvNumber,
          sourceType: e.sourceType, sourceNumber: e.sourceNumber ?? "",
          description: e.description, party: l.studentRef ?? l.supplierRef ?? "",
          kind: "Output", taxableAmount: taxable, vatAmount: vat,
          totalAmount: round2(taxable + vat),
        });
      } else if (l.accountCode === settings.inputVatAccount) {
        const vat = round2(l.debit - l.credit); // debits increase recoverable Input VAT
        inputVat = round2(inputVat + vat);
        const taxable = round2(e.lines
          .filter((x) => x.accountCode !== settings.inputVatAccount && x.debit > 0)
          .reduce((s, x) => s + x.debit, 0));
        transactions.push({
          date: e.date.toISOString().slice(0, 10), jvNumber: e.jvNumber,
          sourceType: e.sourceType, sourceNumber: e.sourceNumber ?? "",
          description: e.description, party: l.supplierRef ?? l.studentRef ?? "",
          kind: "Input", taxableAmount: taxable, vatAmount: vat,
          totalAmount: round2(taxable + vat),
        });
      }
    }
  }

  return NextResponse.json({
    outputVat: round2(outputVat),
    inputVat: round2(inputVat),
    netVat: round2(outputVat - inputVat), // positive = payable to FTA
    vatRate: settings.vatRate,
    vatEnabled: settings.vatEnabled,
    transactions,
  });
}
