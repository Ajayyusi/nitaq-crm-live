import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight, BarChart3, CreditCard, Receipt } from "lucide-react";
import { auth } from "@/auth";
import connectDB from "@/lib/db";
import { Payment } from "@/models/Financial";
import { FINANCE_METRICS, getOwnerFinanceSummary, uaeThisMonth, type MetricKey } from "@/lib/finance/owner-metrics";
import { hasRole, PAGE_PERMISSIONS } from "@/lib/permissions";
import { describeRange } from "@/lib/dateRange";
import { stagger } from "@/lib/motion";
import { RevenueExpensesChart, CourseRevenuePieChart } from "@/components/finance/FinanceCharts";
import OwnerMetricCard from "@/components/finance/OwnerMetricCard";
import UrlDateFilter from "@/components/shared/UrlDateFilter";
import PageHeader from "@/components/shared/PageHeader";
import PageTransition from "@/components/motion/PageTransition";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Lamp } from "@/components/ui/lamp";
import { LoadError } from "@/components/ui/feedback";

const fmt = (n: number) =>
  "AED " + n.toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const PIE_COLOR_VARS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

/**
 * Finance — the owner view.
 *
 * Every figure comes from lib/finance/owner-metrics (posted journal entries,
 * UAE calendar days), so the cards reconcile with the Trial Balance, and the
 * chart and breakdowns use the same definitions as the cards beside them.
 */
export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const session = await auth();
  const rawRole = (session?.user as { role?: string })?.role ?? "";
  const role = rawRole === "staff" ? "sales" : rawRole;

  const params = await searchParams;
  const defaults = uaeThisMonth();
  // Absent params → this UAE month; present but empty → all time
  const from = params.from !== undefined ? params.from : defaults.from;
  const to = params.to !== undefined ? params.to : defaults.to;
  const periodLabel = from || to ? describeRange(from, to) : "All Time";

  let summary: Awaited<ReturnType<typeof getOwnerFinanceSummary>> | null = null;
  let overdue: { id: string; studentName: string; course: string; amount: number; dueDate: string; paymentType: string }[] = [];
  try {
    await connectDB();
    const [s, rawOverdue] = await Promise.all([
      getOwnerFinanceSummary({ from, to }),
      Payment.find({ status: "Overdue" }).sort({ dueDate: 1, createdAt: -1 }).limit(8).lean(),
    ]);
    summary = s;
    overdue = rawOverdue.map((p) => ({
      id: String(p._id),
      studentName: p.studentName ?? "",
      course: p.course ?? "",
      amount: p.amount ?? 0,
      dueDate: p.dueDate ? p.dueDate.toISOString().slice(0, 10) : "",
      paymentType: p.paymentType ?? "",
    }));
  } catch (err) {
    // Log the cause — a silent catch made database failures indistinguishable from bugs
    console.error("[finance] failed to load owner finance summary:", err);
  }

  if (!summary) {
    return (
      <PageTransition>
        <div>
          <PageHeader title="Finance" subtitle="Money in, money out, profit, cash and obligations" />
          <LoadError message="Couldn't load finance data. Refresh the page, or contact your administrator if it keeps failing." />
        </div>
      </PageTransition>
    );
  }

  /** Click-throughs only for pages this role can actually open. */
  const canOpen = (href: string) => {
    const path = href.split("?")[0];
    const rule = PAGE_PERMISSIONS.find((p) => path.startsWith(p.path));
    return !rule || hasRole(role, rule.roles);
  };
  const link = (href: string) => (canOpen(href) ? href : undefined);
  const periodQuery = `from=${from}&to=${to}`;

  const m = summary.metrics;
  const d = summary.detail;
  const updated = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dubai", hour: "2-digit", minute: "2-digit",
  }).format(new Date(summary.generatedAt));

  const cards: {
    key: MetricKey; sub?: string; href?: string; hrefLabel?: string;
    tone?: "ink" | "accent" | "warn" | "danger";
  }[] = [
    // Row 1 — what we earned, what came in, what's left, what we hold
    { key: "earnedRevenue", tone: "accent", href: link("/accounting/trial-balance"), hrefLabel: "Trial balance" },
    {
      key: "cashCollected", tone: "accent",
      sub: d.otherMoneyIn > 0 ? `+ ${fmt(d.otherMoneyIn)} other money in` : undefined,
      href: link("/accounting/receipts"), hrefLabel: "Receipts",
    },
    {
      key: "netProfit", tone: m.netProfit >= 0 ? "accent" : "danger",
      sub: `Revenue ${fmt(m.earnedRevenue)} − expenses ${fmt(d.recognisedExpenses)}`,
      href: link("/accounting/trial-balance"), hrefLabel: "Trial balance",
    },
    {
      key: "availableCash",
      sub: d.clearingCash > 0 ? `${fmt(d.clearingCash)} still in POS/Tabby/Tamara clearing` : undefined,
      href: link(`/accounting/ledger?account=${summary.cashAccount}&${periodQuery}`), hrefLabel: "Cash ledger",
    },
    // Row 2 — who owes whom, what went out, tax
    {
      key: "customersOweUs", tone: m.customersOweUs > 0 ? "warn" : "ink",
      sub: d.customerAdvances > 0 ? `${fmt(d.customerAdvances)} held as student advances` : undefined,
      href: link("/accounting/receivables"), hrefLabel: "Receivables",
    },
    { key: "weOwe", tone: m.weOwe > 0 ? "warn" : "ink", href: link("/accounting/suppliers"), hrefLabel: "Suppliers" },
    {
      key: "moneyOut",
      href: link(`/accounting/ledger?account=${summary.cashAccount}&${periodQuery}`), hrefLabel: "Cash ledger",
    },
    {
      key: "vatEstimate",
      sub: `Output ${fmt(d.outputVat)} · input ${fmt(d.inputVat)}`,
      href: link("/accounting/vat"), hrefLabel: "VAT report",
    },
  ];

  const maxExpense = Math.max(...summary.expensesByAccount.map((e) => e.total), 1);
  const modules = [
    { href: "/payments", icon: CreditCard, title: "Receipts", desc: "Student receipts, instalments and dues" },
    { href: "/expenses", icon: Receipt, title: "Expenses", desc: "Rent, salaries, marketing, utilities" },
    { href: "/reports", icon: BarChart3, title: "Full Reports", desc: "Leads, enrollments, revenue analytics" },
  ].filter((mod) => canOpen(mod.href));

  return (
    <PageTransition>
      <div>
        <PageHeader
          title="Finance"
          subtitle={`${periodLabel} · every figure from posted journal entries · updated ${updated} UAE`}
          actions={
            <Suspense fallback={null}>
              <UrlDateFilter defaultFrom={defaults.from} defaultTo={defaults.to} />
            </Suspense>
          }
        />

        <div className="space-y-5">
          {/* Owner cards: row 1 earned / collected / profit / cash, row 2 obligations / out / VAT */}
          <section className="grid grid-cols-1 items-stretch gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Key figures">
            {cards.map((c, i) => (
              <OwnerMetricCard
                key={c.key}
                label={FINANCE_METRICS[c.key].label}
                basis={FINANCE_METRICS[c.key].basis}
                definition={FINANCE_METRICS[c.key].definition}
                value={m[c.key]}
                periodLabel={periodLabel}
                sub={c.sub}
                href={c.href}
                hrefLabel={c.hrefLabel}
                tone={c.tone}
                index={Math.min(i + 1, 8)}
              />
            ))}
          </section>

          {/* Chart row */}
          <section className="motion-rise grid gap-4 xl:grid-cols-[1.4fr_0.6fr]" style={stagger(8)}>
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>Earned Revenue vs Expenses</CardTitle>
                  <CardDescription>Last 6 months (UAE) · same definitions as the cards above</CardDescription>
                </div>
                <div className="flex gap-4 text-xs text-dim">
                  <span className="flex items-center gap-1.5">
                    <span aria-hidden className="h-2.5 w-2.5 rounded-lamp" style={{ background: "var(--chart-1)" }} />
                    Earned revenue
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span aria-hidden className="h-2.5 w-2.5 rounded-lamp" style={{ background: "var(--chart-5)" }} />
                    Expenses
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                {summary.monthly.every((row) => row.revenue === 0 && row.expenses === 0) ? (
                  <div className="flex h-52 items-center justify-center rounded-ctl bg-well text-sm text-faint">
                    Nothing posted to revenue or expense accounts in the last six months.
                  </div>
                ) : (
                  <RevenueExpensesChart data={summary.monthly} />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div>
                  <CardTitle>Earned Revenue by Course</CardTitle>
                  <CardDescription>{periodLabel}</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                {summary.revenueByCourse.length === 0 ? (
                  <div className="flex h-48 items-center justify-center rounded-ctl bg-well text-sm text-faint">
                    No revenue recognised in this period
                  </div>
                ) : (
                  <>
                    <CourseRevenuePieChart data={summary.revenueByCourse} />
                    <ul className="mt-3 space-y-1.5">
                      {summary.revenueByCourse.map((c, i) => (
                        <li key={c.name} className="flex items-center justify-between text-xs">
                          <span className="flex min-w-0 items-center gap-2">
                            <span aria-hidden className="h-2 w-2 flex-shrink-0 rounded-lamp" style={{ background: PIE_COLOR_VARS[i % PIE_COLOR_VARS.length] }} />
                            <span className="truncate text-dim" title={c.name}>{c.name}</span>
                          </span>
                          <span className="readout ml-2 flex-shrink-0 text-ink" data-numeric>{fmt(c.value)}</span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </CardContent>
            </Card>
          </section>

          {/* Action panel: who owes us, what's overdue */}
          <section className="motion-rise grid gap-4 xl:grid-cols-2" style={stagger(8)}>
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>Customers Owe Us</CardTitle>
                  <CardDescription>Largest student balances at the end of {periodLabel}</CardDescription>
                </div>
                {canOpen("/accounting/receivables") && (
                  <Link href="/accounting/receivables" className="rounded-ctl border border-bezel-strong px-3 py-1.5 text-xs font-bold uppercase tracking-[0.08em] text-ink transition-colors hover:bg-well">
                    Receivables
                  </Link>
                )}
              </CardHeader>
              <CardContent>
                {summary.topReceivables.length === 0 ? (
                  <p className="text-sm text-dim">No student balances outstanding.</p>
                ) : (
                  <ul className="space-y-2">
                    {summary.topReceivables.map((r, i) => (
                      <li key={r.code} className="motion-row flex items-center justify-between rounded-ctl border border-bezel bg-well px-4 py-2.5" style={stagger(i + 6)}>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-ink">{r.name}</p>
                          <p className="readout truncate text-xs text-faint" data-numeric>{r.code}</p>
                        </div>
                        <span className="readout ml-3 flex-shrink-0 text-sm font-bold text-caution" data-numeric>{fmt(r.balance)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div>
                  <CardTitle className="flex items-center gap-2">
                    Overdue Receipts
                    {overdue.length > 0 && <Lamp variant="alert">{overdue.length} overdue</Lamp>}
                  </CardTitle>
                  <CardDescription>Receipts past their due date · from the receipts register</CardDescription>
                </div>
                {canOpen("/payments") && (
                  <Link href="/payments?status=Overdue" className="rounded-ctl border border-bezel-strong px-3 py-1.5 text-xs font-bold uppercase tracking-[0.08em] text-ink transition-colors hover:bg-well">
                    View all
                  </Link>
                )}
              </CardHeader>
              <CardContent>
                {overdue.length === 0 ? (
                  <p className="text-sm text-dim">No overdue receipts.</p>
                ) : (
                  <ul className="space-y-2">
                    {overdue.map((p, i) => (
                      <li key={p.id} className="motion-row flex items-center justify-between rounded-ctl border border-alert/30 bg-[var(--lamp-alert-bg)] px-4 py-2.5" style={stagger(i + 6)}>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-ink">{p.studentName}</p>
                          <p className="truncate text-xs text-faint">{p.course || p.paymentType}</p>
                        </div>
                        <div className="ml-3 flex-shrink-0 text-right">
                          <p className="readout text-sm font-bold text-alert" data-numeric>{fmt(p.amount)}</p>
                          {p.dueDate && <p className="text-xs text-faint">Due {p.dueDate}</p>}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </section>

          {/* Expenses by account + modules */}
          <section className="motion-rise grid gap-4 xl:grid-cols-2" style={stagger(8)}>
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>Expenses by Account</CardTitle>
                  <CardDescription>{periodLabel} · includes teacher pay and supplier bills</CardDescription>
                </div>
                {canOpen("/expenses") && (
                  <Link href="/expenses" className="rounded-ctl border border-bezel-strong px-3 py-1.5 text-xs font-bold uppercase tracking-[0.08em] text-ink transition-colors hover:bg-well">
                    All expenses
                  </Link>
                )}
              </CardHeader>
              <CardContent>
                {summary.expensesByAccount.length === 0 ? (
                  <p className="text-sm text-dim">No expenses recognised in this period.</p>
                ) : (
                  <div className="space-y-3">
                    {summary.expensesByAccount.map((e, i) => {
                      const pct = Math.max(0, Math.round((e.total / maxExpense) * 100));
                      return (
                        <div key={e.code}>
                          <div className="mb-1 flex items-baseline justify-between gap-2">
                            <span className="truncate text-sm text-ink" title={e.name}>{e.name}</span>
                            <span className="readout text-sm text-ink" data-numeric>{fmt(e.total)}</span>
                          </div>
                          <div
                            role="progressbar"
                            aria-valuenow={pct}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-label={`${e.name} share of largest expense account`}
                            className="h-2 overflow-hidden rounded-sm bg-well"
                          >
                            <div className="motion-bar h-full rounded-sm" style={{ width: `${pct}%`, background: "var(--chart-5)", ...stagger(i) }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Finance Modules</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {modules.map((mod) => {
                  const Icon = mod.icon;
                  return (
                    <Link
                      key={mod.href}
                      href={mod.href}
                      className="group flex items-center gap-4 rounded-ctl border border-bezel bg-well p-4 transition-colors hover:border-phos/60"
                    >
                      <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-ctl border border-bezel bg-face">
                        <Icon className="h-5 w-5 text-phos" aria-hidden />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-bold text-ink">{mod.title}</span>
                        <span className="block truncate text-xs text-dim">{mod.desc}</span>
                      </span>
                      <ArrowRight className="ml-auto h-4 w-4 flex-shrink-0 text-faint transition-colors group-hover:text-phos rtl:rotate-180" aria-hidden />
                    </Link>
                  );
                })}
              </CardContent>
            </Card>
          </section>
        </div>
      </div>
    </PageTransition>
  );
}
