import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { createJournalEntry, AccountingError } from "@/lib/accounting/engine";
import { requireAuth } from "@/lib/api-auth";
import { logAudit } from "@/lib/audit";

/**
 * Bulk-import journal vouchers from CSV rows.
 *
 * Expected columns (header row, case-insensitive):
 *   Voucher, Date, Description, AccountCode, Debit, Credit, [Reference], [LineDescription]
 *
 * Rows sharing the same "Voucher" value are grouped into ONE journal entry.
 * Each group must balance (debits = credits). Every account must be an active
 * posting account. Entries are created as Draft unless post=true.
 */
export async function POST(request: NextRequest) {
  const authed = await requireAuth(["admin", "accountant"]);
  if (authed instanceof NextResponse) return authed;

  try {
    await connectDB();
    const body = await request.json();
    const rows: Record<string, string>[] = Array.isArray(body.rows) ? body.rows : [];
    const post = body.post === true;

    if (rows.length === 0) {
      return NextResponse.json({ message: "No rows to import." }, { status: 400 });
    }

    // Normalise keys to lowercase for tolerant column matching
    const get = (r: Record<string, string>, ...keys: string[]) => {
      for (const k of Object.keys(r)) {
        const lk = k.toLowerCase().replace(/[\s_]/g, "");
        if (keys.some((want) => lk === want)) return r[k];
      }
      return "";
    };

    // Group rows by voucher key (fallback: sequential blocks separated by a
    // blank voucher are grouped by the last non-empty voucher label)
    const groups = new Map<string, Record<string, string>[]>();
    let lastKey = "";
    let auto = 0;
    for (const r of rows) {
      let key = String(get(r, "voucher", "voucherno", "jv", "jvno", "vouchernumber")).trim();
      if (!key) key = lastKey || `AUTO-${++auto}`;
      lastKey = key;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(r);
    }

    const results: { voucher: string; jvNumber?: string; error?: string }[] = [];
    let created = 0;

    for (const [voucher, groupRows] of groups) {
      try {
        const first = groupRows[0];
        const date = String(get(first, "date")).trim() || new Date().toISOString().slice(0, 10);
        const description =
          String(get(first, "description", "narration", "memo")).trim() || `Imported voucher ${voucher}`;
        const reference = String(get(first, "reference", "ref", "refno")).trim() || voucher;

        const lines = groupRows
          .map((r) => ({
            accountCode: String(get(r, "accountcode", "account", "code", "ledgcode")).trim(),
            debit: Number(String(get(r, "debit", "dr")).replace(/,/g, "")) || 0,
            credit: Number(String(get(r, "credit", "cr")).replace(/,/g, "")) || 0,
            description: String(get(r, "linedescription", "linedescr", "particulars")).trim() || undefined,
          }))
          .filter((l) => l.accountCode && (l.debit || l.credit));

        if (lines.length < 2) throw new AccountingError("Voucher needs at least two lines.");

        const entry = await createJournalEntry({
          date,
          sourceType: "JV",
          description,
          reference,
          lines,
          createdBy: `${authed.name} (import)`,
          autoPost: post,
        });
        results.push({ voucher, jvNumber: entry.jvNumber });
        created++;
      } catch (err) {
        results.push({ voucher, error: err instanceof Error ? err.message : "Failed" });
      }
    }

    logAudit({
      userName: authed.name, userRole: authed.role,
      action: "created", entity: "JournalEntry", entityId: "import",
      entityLabel: "JV Import", detail: `${created}/${groups.size} vouchers imported`,
    });

    return NextResponse.json({
      message: `${created} of ${groups.size} vouchers imported${post ? " and posted" : " as drafts"}.`,
      created,
      total: groups.size,
      results,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Import failed.";
    return NextResponse.json({ message }, { status: 400 });
  }
}
