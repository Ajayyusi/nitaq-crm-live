"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  Building2, ChevronDown, ChevronLeft, ChevronUp, Loader2, Plus, RefreshCw, X,
} from "lucide-react";
import DatePicker from "@/components/shared/DatePicker";
import { AccountSelect, fmtAED, fmtNum, usePostingAccounts } from "@/components/accounting/shared";

interface Supplier {
  id: string; supplierCode: string; name: string; contactPerson: string; phone: string;
  email: string; trn: string; address: string; vatRegistered: boolean;
  defaultExpenseAccountCode: string; openingBalance: number;
  totalBilled: number; totalPaid: number; balance: number; isActive: boolean;
}
interface Bill {
  id: string; billNumber: string; billDate: string; dueDate: string; reference: string;
  description: string; amountBeforeVAT: number; vatAmount: number; totalAmount: number;
  amountPaid: number; status: string;
}
interface Detail {
  statement: { date: string; type: string; number: string; description: string; amount: number; balance: number }[];
  balance: number;
  aging: { current: number; d30: number; d60: number; d90: number };
  bills: Bill[];
}

const billBadge: Record<string, string> = {
  Unpaid:           "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  "Partially Paid": "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  Paid:             "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  Cancelled:        "bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-gray-400",
};

const inp = "h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-[#2E7D32] dark:border-white/10 dark:bg-white/5 dark:text-white";

export default function SuppliersPage() {
  const { data: session } = useSession();
  const role = (session?.user as { role?: string })?.role ?? "";
  const canEdit = role === "admin" || role === "accountant";

  const { accounts } = usePostingAccounts();
  const expenseAccounts = accounts.filter((a) => a.type === "Expense" || a.type === "Asset");
  const moneyAccounts = accounts.filter((a) => a.mainAccount === "CASH" || a.mainAccount === "BANKS");

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [drawer, setDrawer] = useState<"" | "supplier" | "bill" | "payment">("");
  const [drawerSupplier, setDrawerSupplier] = useState<Supplier | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const emptySupForm = { supplierCode: "", name: "", contactPerson: "", phone: "", email: "", trn: "", address: "", vatRegistered: false, defaultExpenseAccountCode: "", openingBalance: "" };
  const [supForm, setSupForm] = useState(emptySupForm);
  const [billForm, setBillForm] = useState({ billDate: new Date().toISOString().slice(0, 10), dueDate: "", reference: "", description: "", expenseAccountCode: "", amountBeforeVAT: "", vatRate: "5" });
  const [payForm, setPayForm] = useState({ paymentDate: new Date().toISOString().slice(0, 10), amount: "", paymentAccountCode: "", billId: "", reference: "", notes: "" });

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/accounting/suppliers")
      .then((r) => r.json())
      .then((d) => setSuppliers(d.suppliers ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  const loadDetail = useCallback((id: string) => {
    setDetailLoading(true);
    fetch(`/api/accounting/suppliers/${id}`)
      .then((r) => r.json())
      .then((d) => setDetail(d))
      .catch(() => {})
      .finally(() => setDetailLoading(false));
  }, []);

  const toggle = (s: Supplier) => {
    if (expanded === s.id) { setExpanded(null); setDetail(null); return; }
    setExpanded(s.id);
    setDetail(null);
    loadDetail(s.id);
  };

  const submitSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setFormError("");
    try {
      const res = await fetch("/api/accounting/suppliers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...supForm, openingBalance: Number(supForm.openingBalance) || 0 }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.message);
      setDrawer(""); setSupForm(emptySupForm); load();
    } catch (err) { setFormError((err as Error).message); }
    finally { setSaving(false); }
  };

  const submitBill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!drawerSupplier) return;
    setSaving(true); setFormError("");
    try {
      const res = await fetch("/api/accounting/supplier-bills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...billForm,
          supplierId: drawerSupplier.id,
          amountBeforeVAT: Number(billForm.amountBeforeVAT) || 0,
          vatRate: drawerSupplier.vatRegistered ? Number(billForm.vatRate) || 0 : 0,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.message);
      setDrawer("");
      load();
      if (expanded === drawerSupplier.id) loadDetail(drawerSupplier.id);
    } catch (err) { setFormError((err as Error).message); }
    finally { setSaving(false); }
  };

  const submitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!drawerSupplier) return;
    setSaving(true); setFormError("");
    try {
      const res = await fetch("/api/accounting/supplier-payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payForm, supplierId: drawerSupplier.id, amount: Number(payForm.amount) || 0 }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.message);
      setDrawer("");
      load();
      if (expanded === drawerSupplier.id) loadDetail(drawerSupplier.id);
    } catch (err) { setFormError((err as Error).message); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/accounting" className="mb-1 inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"><ChevronLeft className="h-3 w-3" /> Accounting</Link>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Suppliers</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{suppliers.length} suppliers · total payable {fmtAED(suppliers.reduce((s, x) => s + x.balance, 0))}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="grid h-9 w-9 place-items-center rounded-lg border border-gray-200 bg-white text-gray-500 shadow-sm dark:border-white/10 dark:bg-white/5"><RefreshCw className="h-4 w-4" /></button>
          {canEdit && (
            <button onClick={() => { setDrawer("supplier"); setFormError(""); }} className="flex items-center gap-1.5 rounded-lg bg-[#2E7D32] px-3.5 py-2 text-sm font-semibold text-white hover:bg-[#1B5E20]">
              <Plus className="h-4 w-4" /> Add Supplier
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center text-gray-400"><Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…</div>
      ) : suppliers.length === 0 ? (
        <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-gray-200 text-gray-400 dark:border-white/10">
          <Building2 className="h-8 w-8" />
          <p className="text-sm">No suppliers yet. Seed the Chart of Accounts or add one.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {suppliers.map((s) => {
            const open = expanded === s.id;
            return (
              <div key={s.id} className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/5">
                <button onClick={() => toggle(s)} className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-left">
                  <span className="font-mono text-xs font-bold text-gray-400">{s.supplierCode}</span>
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-900 dark:text-white">{s.name}</span>
                  {s.vatRegistered && <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">VAT</span>}
                  <span className={`text-sm font-bold tabular-nums ${s.balance > 0 ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}`}>{fmtAED(s.balance)}</span>
                  {open ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                </button>
                {open && (
                  <div className="border-t border-gray-100 px-4 py-4 dark:border-white/10">
                    {detailLoading || !detail ? (
                      <div className="flex h-20 items-center justify-center text-gray-400"><Loader2 className="h-4 w-4 animate-spin" /></div>
                    ) : (
                      <div className="space-y-4">
                        {/* Aging */}
                        <div className="grid grid-cols-4 gap-2 text-center">
                          {[["Current", detail.aging.current], ["1–30d", detail.aging.d30], ["31–60d", detail.aging.d60], ["60d+", detail.aging.d90]].map(([label, v]) => (
                            <div key={label as string} className="rounded-lg bg-gray-50 px-2 py-2 dark:bg-white/5">
                              <p className="text-[10px] font-bold uppercase text-gray-400">{label}</p>
                              <p className={`text-sm font-bold tabular-nums ${Number(v) > 0 ? "text-red-600 dark:text-red-400" : "text-gray-400"}`}>{fmtNum(Number(v))}</p>
                            </div>
                          ))}
                        </div>

                        {/* Actions */}
                        {canEdit && (
                          <div className="flex gap-2">
                            <button onClick={() => { setDrawerSupplier(s); setBillForm((f) => ({ ...f, expenseAccountCode: s.defaultExpenseAccountCode || "" })); setDrawer("bill"); setFormError(""); }}
                              className="rounded-lg bg-[#2E7D32] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#1B5E20]">+ Bill</button>
                            <button onClick={() => { setDrawerSupplier(s); setDrawer("payment"); setFormError(""); }}
                              className="rounded-lg border border-[#2E7D32] px-3 py-1.5 text-xs font-semibold text-[#2E7D32] hover:bg-green-50 dark:text-green-400">+ Payment</button>
                          </div>
                        )}

                        {/* Statement */}
                        <div className="overflow-x-auto">
                          <table className="min-w-full text-sm">
                            <thead>
                              <tr className="text-left text-xs font-bold uppercase text-gray-400">
                                <th className="py-1 pr-3">Date</th><th className="py-1 pr-3">Doc</th><th className="py-1 pr-3">Type</th>
                                <th className="py-1 pr-3 text-right">Amount</th><th className="py-1 text-right">Balance</th>
                              </tr>
                            </thead>
                            <tbody>
                              {detail.statement.length === 0 && (
                                <tr><td colSpan={5} className="py-3 text-center text-xs text-gray-400">No transactions.</td></tr>
                              )}
                              {detail.statement.map((r, i) => (
                                <tr key={i} className="border-t border-gray-50 dark:border-white/5">
                                  <td className="py-1.5 pr-3 text-xs text-gray-500">{r.date}</td>
                                  <td className="py-1.5 pr-3 font-mono text-xs">{r.number}</td>
                                  <td className="py-1.5 pr-3">
                                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${r.type === "Bill" ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" : "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"}`}>{r.type}</span>
                                  </td>
                                  <td className="py-1.5 pr-3 text-right tabular-nums">{fmtNum(r.amount)}</td>
                                  <td className="py-1.5 text-right font-semibold tabular-nums">{fmtNum(r.balance)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        {/* Open bills */}
                        {detail.bills.filter((b) => b.status === "Unpaid" || b.status === "Partially Paid").length > 0 && (
                          <div>
                            <p className="mb-1 text-xs font-bold uppercase text-gray-400">Open Bills</p>
                            <div className="space-y-1">
                              {detail.bills.filter((b) => b.status === "Unpaid" || b.status === "Partially Paid").map((b) => (
                                <div key={b.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-100 px-3 py-1.5 text-xs dark:border-white/10">
                                  <span className="font-mono font-semibold">{b.billNumber}</span>
                                  <span className="text-gray-400">{b.billDate}</span>
                                  <span className={`rounded-full px-2 py-0.5 font-bold ${billBadge[b.status]}`}>{b.status}</span>
                                  <span className="flex-1" />
                                  <span className="tabular-nums text-gray-500">{fmtNum(b.amountPaid)} / {fmtNum(b.totalAmount)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Drawers */}
      {drawer && (
        <div className="fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/40" onClick={() => setDrawer("")} />
          <aside className="relative ml-auto flex h-full w-full max-w-md flex-col bg-white shadow-2xl dark:bg-[#0D1F0E]">
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-white/10">
              <h2 className="font-bold text-gray-900 dark:text-white">
                {drawer === "supplier" ? "Add Supplier" : drawer === "bill" ? `New Bill — ${drawerSupplier?.name}` : `Record Payment — ${drawerSupplier?.name}`}
              </h2>
              <button onClick={() => setDrawer("")} className="rounded-lg p-1.5 hover:bg-gray-100 dark:hover:bg-white/10"><X className="h-4 w-4 text-gray-500" /></button>
            </div>
            <form onSubmit={drawer === "supplier" ? submitSupplier : drawer === "bill" ? submitBill : submitPayment} className="flex-1 space-y-4 overflow-y-auto p-5">
              {formError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-400">{formError}</p>}

              {drawer === "supplier" && (
                <>
                  <div><label className="label-x">Supplier Name *</label><input required value={supForm.name} onChange={(e) => setSupForm((f) => ({ ...f, name: e.target.value }))} className={inp} /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="label-x">Code (auto if empty)</label><input value={supForm.supplierCode} onChange={(e) => setSupForm((f) => ({ ...f, supplierCode: e.target.value }))} className={inp} placeholder="SP004" /></div>
                    <div><label className="label-x">TRN</label><input value={supForm.trn} onChange={(e) => setSupForm((f) => ({ ...f, trn: e.target.value }))} className={inp} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="label-x">Contact Person</label><input value={supForm.contactPerson} onChange={(e) => setSupForm((f) => ({ ...f, contactPerson: e.target.value }))} className={inp} /></div>
                    <div><label className="label-x">Phone</label><input value={supForm.phone} onChange={(e) => setSupForm((f) => ({ ...f, phone: e.target.value }))} className={inp} /></div>
                  </div>
                  <div><label className="label-x">Email</label><input type="email" value={supForm.email} onChange={(e) => setSupForm((f) => ({ ...f, email: e.target.value }))} className={inp} /></div>
                  <div><label className="label-x">Address</label><input value={supForm.address} onChange={(e) => setSupForm((f) => ({ ...f, address: e.target.value }))} className={inp} /></div>
                  <div><label className="label-x">Default Expense Account</label>
                    <AccountSelect value={supForm.defaultExpenseAccountCode} onChange={(v) => setSupForm((f) => ({ ...f, defaultExpenseAccountCode: v }))} accounts={expenseAccounts} />
                  </div>
                  <div><label className="label-x">Opening Balance (we owe)</label><input type="number" step="0.01" value={supForm.openingBalance} onChange={(e) => setSupForm((f) => ({ ...f, openingBalance: e.target.value }))} className={inp} /></div>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={supForm.vatRegistered} onChange={(e) => setSupForm((f) => ({ ...f, vatRegistered: e.target.checked }))} className="h-4 w-4 accent-[#2E7D32]" />
                    <span className="text-gray-700 dark:text-gray-300">VAT registered</span>
                  </label>
                </>
              )}

              {drawer === "bill" && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="label-x">Bill Date *</label><DatePicker value={billForm.billDate} onChange={(v) => setBillForm((f) => ({ ...f, billDate: v }))} required /></div>
                    <div><label className="label-x">Due Date</label><DatePicker value={billForm.dueDate} onChange={(v) => setBillForm((f) => ({ ...f, dueDate: v }))} /></div>
                  </div>
                  <div><label className="label-x">Supplier Invoice No.</label><input value={billForm.reference} onChange={(e) => setBillForm((f) => ({ ...f, reference: e.target.value }))} className={inp} /></div>
                  <div><label className="label-x">Expense Account *</label>
                    <AccountSelect value={billForm.expenseAccountCode} onChange={(v) => setBillForm((f) => ({ ...f, expenseAccountCode: v }))} accounts={expenseAccounts} />
                  </div>
                  <div><label className="label-x">Description</label><input value={billForm.description} onChange={(e) => setBillForm((f) => ({ ...f, description: e.target.value }))} className={inp} /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="label-x">Amount (excl. VAT) *</label><input required type="number" step="0.01" min="0.01" value={billForm.amountBeforeVAT} onChange={(e) => setBillForm((f) => ({ ...f, amountBeforeVAT: e.target.value }))} className={inp} /></div>
                    <div><label className="label-x">VAT %</label>
                      <select value={drawerSupplier?.vatRegistered ? billForm.vatRate : "0"} disabled={!drawerSupplier?.vatRegistered} onChange={(e) => setBillForm((f) => ({ ...f, vatRate: e.target.value }))} className={inp}>
                        <option value="0">0% (exempt)</option>
                        <option value="5">5%</option>
                      </select>
                    </div>
                  </div>
                  {Number(billForm.amountBeforeVAT) > 0 && (
                    <p className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500 dark:bg-white/5 dark:text-gray-400">
                      Total incl. VAT: <strong>{fmtAED(Number(billForm.amountBeforeVAT) * (1 + (drawerSupplier?.vatRegistered ? Number(billForm.vatRate) : 0) / 100))}</strong>
                    </p>
                  )}
                </>
              )}

              {drawer === "payment" && (
                <>
                  <div><label className="label-x">Payment Date *</label><DatePicker value={payForm.paymentDate} onChange={(v) => setPayForm((f) => ({ ...f, paymentDate: v }))} required /></div>
                  <div><label className="label-x">Amount *</label><input required type="number" step="0.01" min="0.01" value={payForm.amount} onChange={(e) => setPayForm((f) => ({ ...f, amount: e.target.value }))} className={inp} /></div>
                  <div><label className="label-x">Paid From *</label>
                    <AccountSelect value={payForm.paymentAccountCode} onChange={(v) => setPayForm((f) => ({ ...f, paymentAccountCode: v }))} accounts={moneyAccounts.length ? moneyAccounts : accounts} placeholder="Cash / Bank / Petty Cash…" />
                  </div>
                  {detail && detail.bills.filter((b) => b.status !== "Paid" && b.status !== "Cancelled").length > 0 && (
                    <div><label className="label-x">Apply to Bill (optional)</label>
                      <select value={payForm.billId} onChange={(e) => setPayForm((f) => ({ ...f, billId: e.target.value }))} className={inp}>
                        <option value="">— On account —</option>
                        {detail.bills.filter((b) => b.status !== "Paid" && b.status !== "Cancelled").map((b) => (
                          <option key={b.id} value={b.id}>{b.billNumber} · open {fmtNum(b.totalAmount - b.amountPaid)}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div><label className="label-x">Reference</label><input value={payForm.reference} onChange={(e) => setPayForm((f) => ({ ...f, reference: e.target.value }))} className={inp} /></div>
                  <div><label className="label-x">Notes</label><input value={payForm.notes} onChange={(e) => setPayForm((f) => ({ ...f, notes: e.target.value }))} className={inp} /></div>
                </>
              )}

              <button type="submit" disabled={saving} className="w-full rounded-lg bg-[#2E7D32] py-2.5 text-sm font-semibold text-white hover:bg-[#1B5E20] disabled:opacity-60">
                {saving ? "Saving…" : drawer === "supplier" ? "Create Supplier" : drawer === "bill" ? "Save Bill" : "Record Payment"}
              </button>
            </form>
          </aside>
        </div>
      )}
      <style>{`.label-x { display:block; margin-bottom:0.25rem; font-size:0.75rem; font-weight:600; color:#4B5563; }`}</style>
    </div>
  );
}
