"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { Building2, ChevronDown, ChevronUp, Download, Plus, RefreshCw } from "lucide-react";
import DatePicker from "@/components/shared/DatePicker";
import { AccountSelect, exportCsv, fmtAED, fmtNum, usePostingAccounts } from "@/components/accounting/shared";
import BackButton from "@/components/shared/BackButton";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Lamp, type LampVariant } from "@/components/ui/lamp";
import { Input, Field, SearchInput, Select } from "@/components/ui/input";
import { Drawer } from "@/components/ui/dialog";
import { usePagination, Pagination } from "@/components/ui/table";
import { Spinner, SkeletonRows, LoadError } from "@/components/ui/feedback";

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

const billLamp: Record<string, LampVariant> = {
  Unpaid: "alert",
  "Partially Paid": "caution",
  Paid: "ok",
  Cancelled: "off",
};

export default function SuppliersPage() {
  const { data: session } = useSession();
  const role = (session?.user as { role?: string })?.role ?? "";
  const canEdit = role === "admin" || role === "accountant";

  const { accounts } = usePostingAccounts();
  const expenseAccounts = accounts.filter((a) => a.type === "Expense" || a.type === "Asset");
  const moneyAccounts = accounts.filter((a) => a.mainAccount === "CASH" || a.mainAccount === "BANKS");

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailFailed, setDetailFailed] = useState(false);

  const [drawer, setDrawer] = useState<"" | "supplier" | "bill" | "payment">("");
  const [drawerSupplier, setDrawerSupplier] = useState<Supplier | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | undefined>>({});

  const emptySupForm = { supplierCode: "", name: "", contactPerson: "", phone: "", email: "", trn: "", address: "", vatRegistered: false, defaultExpenseAccountCode: "", openingBalance: "" };
  const [supForm, setSupForm] = useState(emptySupForm);
  const [billForm, setBillForm] = useState({ billDate: new Date().toISOString().slice(0, 10), dueDate: "", reference: "", description: "", expenseAccountCode: "", amountBeforeVAT: "", vatRate: "5" });
  const [payForm, setPayForm] = useState({ paymentDate: new Date().toISOString().slice(0, 10), amount: "", paymentAccountCode: "", billId: "", reference: "", notes: "" });

  const load = useCallback(() => {
    setLoading(true);
    setLoadFailed(false);
    fetch("/api/accounting/suppliers")
      .then((r) => r.json())
      .then((d) => setSuppliers(d.suppliers ?? []))
      .catch(() => setLoadFailed(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  const loadDetail = useCallback((id: string) => {
    setDetailLoading(true);
    setDetailFailed(false);
    fetch(`/api/accounting/suppliers/${id}`)
      .then((r) => r.json())
      .then((d) => setDetail(d))
      .catch(() => setDetailFailed(true))
      .finally(() => setDetailLoading(false));
  }, []);

  const toggle = (s: Supplier) => {
    if (expanded === s.id) { setExpanded(null); setDetail(null); return; }
    setExpanded(s.id);
    setDetail(null);
    loadDetail(s.id);
  };

  const openDrawer = (kind: "supplier" | "bill" | "payment", s?: Supplier) => {
    if (s) setDrawerSupplier(s);
    if (kind === "bill" && s) setBillForm((f) => ({ ...f, expenseAccountCode: s.defaultExpenseAccountCode || "" }));
    setFormError("");
    setFieldErrors({});
    setDrawer(kind);
  };

  const submitSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string | undefined> = {};
    if (!supForm.name.trim()) errs.name = "Enter the supplier's name.";
    setFieldErrors(errs);
    if (Object.values(errs).some(Boolean)) return;
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
    } catch (err) { setFormError((err as Error).message || "Couldn't create the supplier. Retry."); }
    finally { setSaving(false); }
  };

  const submitBill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!drawerSupplier) return;
    const errs: Record<string, string | undefined> = {};
    if (!billForm.billDate) errs.billDate = "Pick the bill date.";
    if (!billForm.expenseAccountCode) errs.expenseAccountCode = "Choose the expense account.";
    if (!(Number(billForm.amountBeforeVAT) > 0)) errs.amountBeforeVAT = "Enter an amount above zero.";
    setFieldErrors(errs);
    if (Object.values(errs).some(Boolean)) return;
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
    } catch (err) { setFormError((err as Error).message || "Couldn't save the bill. Retry."); }
    finally { setSaving(false); }
  };

  const submitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!drawerSupplier) return;
    const errs: Record<string, string | undefined> = {};
    if (!payForm.paymentDate) errs.paymentDate = "Pick the payment date.";
    if (!(Number(payForm.amount) > 0)) errs.amount = "Enter an amount above zero.";
    if (!payForm.paymentAccountCode) errs.paymentAccountCode = "Choose the account the money left from.";
    setFieldErrors(errs);
    if (Object.values(errs).some(Boolean)) return;
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
    } catch (err) { setFormError((err as Error).message || "Couldn't record the payment. Retry."); }
    finally { setSaving(false); }
  };

  const filtered = suppliers.filter((s) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return [s.name, s.supplierCode, s.contactPerson, s.trn].some((v) => (v ?? "").toLowerCase().includes(q));
  });
  const { slice, page, pages, setPage, total: pageTotal } = usePagination(filtered, 50);

  const drawerTitle =
    drawer === "supplier" ? "Add Supplier"
      : drawer === "bill" ? `New Bill — ${drawerSupplier?.name ?? ""}`
        : `Record Payment — ${drawerSupplier?.name ?? ""}`;
  const drawerSubmitLabel =
    saving ? "Saving…" : drawer === "supplier" ? "Create Supplier" : drawer === "bill" ? "Save Bill" : "Record Payment";

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <BackButton />
      <PageHeader
        title="Suppliers"
        subtitle={`${suppliers.length} suppliers · total payable ${fmtAED(suppliers.reduce((s, x) => s + x.balance, 0))}`}
        actions={
          <>
            <Button variant="ghost" size="icon" onClick={load} aria-label="Reload suppliers">
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button
              variant="primary"
              onClick={() => exportCsv("suppliers.csv",
                ["Code", "Supplier", "TRN", "VAT Registered", "Opening", "Billed", "Paid", "Balance"],
                suppliers.map((s) => [s.supplierCode, s.name, s.trn, s.vatRegistered ? "Yes" : "No", s.openingBalance, s.totalBilled, s.totalPaid, s.balance]))}
              disabled={suppliers.length === 0}
            >
              <Download className="h-4 w-4" /> Excel / CSV
            </Button>
            {canEdit && (
              <Button variant="solid" onClick={() => openDrawer("supplier")}>
                <Plus className="h-4 w-4" /> Add Supplier
              </Button>
            )}
          </>
        }
      />

      <SearchInput
        placeholder="Search supplier, code, TRN…"
        aria-label="Search suppliers"
        value={search}
        onChange={(e) => { setSearch(e.target.value); setPage(0); }}
        className="max-w-sm"
      />

      {loading ? (
        <div className="face"><SkeletonRows rows={6} cols={4} /></div>
      ) : loadFailed ? (
        <LoadError message="Couldn't load suppliers. Check your connection and retry." onRetry={load} />
      ) : filtered.length === 0 ? (
        <div className="face">
          <EmptyState
            icon={Building2}
            title={search ? "No suppliers match this search" : "No suppliers yet"}
            description={search ? "Try a different name, code, or TRN." : "Add your first supplier to start tracking bills and payments."}
            action={
              canEdit && !search ? (
                <Button variant="primary" size="sm" onClick={() => openDrawer("supplier")}>
                  <Plus className="h-4 w-4" /> Add Supplier
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {slice.map((s) => {
              const open = expanded === s.id;
              return (
                <div key={s.id} className="face overflow-hidden">
                  <button
                    onClick={() => toggle(s)}
                    aria-expanded={open}
                    className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-left transition-colors hover:bg-well"
                  >
                    <span className="readout text-xs font-bold text-faint" data-numeric>{s.supplierCode}</span>
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink" title={s.name}>{s.name}</span>
                    {s.vatRegistered && <Lamp variant="advisory">VAT</Lamp>}
                    <span className={`readout text-sm font-bold ${s.balance > 0 ? "text-alert" : "text-phos"}`} data-numeric>{fmtAED(s.balance)}</span>
                    {open ? <ChevronUp className="h-4 w-4 text-faint" aria-hidden /> : <ChevronDown className="h-4 w-4 text-faint" aria-hidden />}
                  </button>
                  {open && (
                    <div className="border-t border-bezel px-4 py-4">
                      {detailLoading ? (
                        <div className="flex h-20 items-center justify-center"><Spinner /></div>
                      ) : detailFailed || !detail ? (
                        <LoadError message="Couldn't load this supplier's statement." onRetry={() => loadDetail(s.id)} className="py-6" />
                      ) : (
                        <div className="space-y-4">
                          {/* Aging */}
                          <div className="grid grid-cols-4 gap-2 text-center">
                            {[["Current", detail.aging.current], ["1–30d", detail.aging.d30], ["31–60d", detail.aging.d60], ["60d+", detail.aging.d90]].map(([label, v]) => (
                              <div key={label as string} className="rounded-ctl bg-well px-2 py-2">
                                <p className="placard">{label}</p>
                                <p className={`readout text-sm font-bold ${Number(v) > 0 ? "text-alert" : "text-faint"}`} data-numeric>{fmtNum(Number(v))}</p>
                              </div>
                            ))}
                          </div>

                          {/* Actions */}
                          {canEdit && (
                            <div className="flex gap-2">
                              <Button variant="primary" size="sm" onClick={() => openDrawer("bill", s)}>
                                <Plus className="h-3.5 w-3.5" /> Bill
                              </Button>
                              <Button variant="secondary" size="sm" onClick={() => openDrawer("payment", s)}>
                                <Plus className="h-3.5 w-3.5" /> Payment
                              </Button>
                            </div>
                          )}

                          {/* Statement */}
                          <div className="overflow-x-auto">
                            <table className="min-w-full text-sm">
                              <thead>
                                <tr className="text-left">
                                  <th className="placard py-1 pr-3">Date</th>
                                  <th className="placard py-1 pr-3">Doc</th>
                                  <th className="placard py-1 pr-3">Type</th>
                                  <th className="placard py-1 pr-3 text-right">Amount</th>
                                  <th className="placard py-1 text-right">Balance</th>
                                </tr>
                              </thead>
                              <tbody>
                                {detail.statement.length === 0 && (
                                  <tr><td colSpan={5} className="py-3 text-center text-xs text-faint">No transactions.</td></tr>
                                )}
                                {detail.statement.map((r, i) => (
                                  <tr key={i} className="border-t border-bezel/60">
                                    <td className="readout py-1.5 pr-3 text-xs text-dim" data-numeric>{r.date}</td>
                                    <td className="readout py-1.5 pr-3 text-xs" data-numeric>{r.number}</td>
                                    <td className="py-1.5 pr-3">
                                      <Lamp variant={r.type === "Bill" ? "caution" : "ok"}>{r.type}</Lamp>
                                    </td>
                                    <td className="readout py-1.5 pr-3 text-right" data-numeric>{fmtNum(r.amount)}</td>
                                    <td className="readout py-1.5 text-right font-semibold" data-numeric>{fmtNum(r.balance)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>

                          {/* Open bills */}
                          {detail.bills.filter((b) => b.status === "Unpaid" || b.status === "Partially Paid").length > 0 && (
                            <div>
                              <p className="placard mb-1">Open Bills</p>
                              <div className="space-y-1">
                                {detail.bills.filter((b) => b.status === "Unpaid" || b.status === "Partially Paid").map((b) => (
                                  <div key={b.id} className="flex flex-wrap items-center gap-2 rounded-ctl border border-bezel px-3 py-1.5 text-xs">
                                    <span className="readout font-semibold" data-numeric>{b.billNumber}</span>
                                    <span className="readout text-faint" data-numeric>{b.billDate}</span>
                                    <Lamp variant={billLamp[b.status] ?? "off"}>{b.status}</Lamp>
                                    <span className="flex-1" />
                                    <span className="readout text-dim" data-numeric>{fmtNum(b.amountPaid)} / {fmtNum(b.totalAmount)}</span>
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
          <div className="face px-4 py-2.5 text-xs text-dim">
            <Pagination page={page} pages={pages} setPage={setPage} total={pageTotal} shown={slice.length} />
          </div>
        </>
      )}

      {/* Drawer: supplier / bill / payment */}
      <Drawer
        open={!!drawer}
        onClose={() => setDrawer("")}
        title={drawerTitle}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDrawer("")} disabled={saving}>Cancel</Button>
            <Button variant="solid" type="submit" form="supplier-drawer-form" disabled={saving}>
              {drawerSubmitLabel}
            </Button>
          </>
        }
      >
        <form
          id="supplier-drawer-form"
          onSubmit={drawer === "supplier" ? submitSupplier : drawer === "bill" ? submitBill : submitPayment}
          className="space-y-4"
        >
          {formError && (
            <p role="alert" className="rounded-ctl border border-alert/30 bg-[var(--lamp-alert-bg)] px-3 py-2 text-sm font-semibold text-alert">
              {formError}
            </p>
          )}

          {drawer === "supplier" && (
            <>
              <Field label="Supplier Name" required error={fieldErrors.name}>
                <Input required value={supForm.name} onChange={(e) => { setSupForm((f) => ({ ...f, name: e.target.value })); setFieldErrors((f) => ({ ...f, name: undefined })); }} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Code" help="Auto-generated if empty">
                  <Input value={supForm.supplierCode} onChange={(e) => setSupForm((f) => ({ ...f, supplierCode: e.target.value }))} placeholder="SP004" />
                </Field>
                <Field label="TRN">
                  <Input value={supForm.trn} onChange={(e) => setSupForm((f) => ({ ...f, trn: e.target.value }))} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Contact Person">
                  <Input value={supForm.contactPerson} onChange={(e) => setSupForm((f) => ({ ...f, contactPerson: e.target.value }))} />
                </Field>
                <Field label="Phone">
                  <Input value={supForm.phone} onChange={(e) => setSupForm((f) => ({ ...f, phone: e.target.value }))} />
                </Field>
              </div>
              <Field label="Email">
                <Input type="email" value={supForm.email} onChange={(e) => setSupForm((f) => ({ ...f, email: e.target.value }))} />
              </Field>
              <Field label="Address">
                <Input value={supForm.address} onChange={(e) => setSupForm((f) => ({ ...f, address: e.target.value }))} />
              </Field>
              <Field label="Default Expense Account">
                <AccountSelect value={supForm.defaultExpenseAccountCode} onChange={(v) => setSupForm((f) => ({ ...f, defaultExpenseAccountCode: v }))} accounts={expenseAccounts} />
              </Field>
              <Field label="Opening Balance" help="Amount we owe this supplier">
                <Input type="number" step="0.01" value={supForm.openingBalance} onChange={(e) => setSupForm((f) => ({ ...f, openingBalance: e.target.value }))} />
              </Field>
              <label className="flex items-center gap-2 text-sm text-ink">
                <input type="checkbox" checked={supForm.vatRegistered} onChange={(e) => setSupForm((f) => ({ ...f, vatRegistered: e.target.checked }))} className="h-4 w-4 accent-phos" />
                VAT registered
              </label>
            </>
          )}

          {drawer === "bill" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Bill Date" required error={fieldErrors.billDate}>
                  <DatePicker value={billForm.billDate} onChange={(v) => { setBillForm((f) => ({ ...f, billDate: v })); setFieldErrors((f) => ({ ...f, billDate: undefined })); }} required />
                </Field>
                <Field label="Due Date">
                  <DatePicker value={billForm.dueDate} onChange={(v) => setBillForm((f) => ({ ...f, dueDate: v }))} />
                </Field>
              </div>
              <Field label="Supplier Invoice No.">
                <Input value={billForm.reference} onChange={(e) => setBillForm((f) => ({ ...f, reference: e.target.value }))} />
              </Field>
              <Field label="Expense Account" required error={fieldErrors.expenseAccountCode}>
                <AccountSelect value={billForm.expenseAccountCode} onChange={(v) => { setBillForm((f) => ({ ...f, expenseAccountCode: v })); setFieldErrors((f) => ({ ...f, expenseAccountCode: undefined })); }} accounts={expenseAccounts} />
              </Field>
              <Field label="Description">
                <Input value={billForm.description} onChange={(e) => setBillForm((f) => ({ ...f, description: e.target.value }))} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Amount (excl. VAT)" required error={fieldErrors.amountBeforeVAT}>
                  <Input required type="number" step="0.01" min="0.01" value={billForm.amountBeforeVAT} onChange={(e) => { setBillForm((f) => ({ ...f, amountBeforeVAT: e.target.value })); setFieldErrors((f) => ({ ...f, amountBeforeVAT: undefined })); }} />
                </Field>
                <Field label="VAT %" help={!drawerSupplier?.vatRegistered ? "Supplier isn't VAT registered" : undefined}>
                  <Select value={drawerSupplier?.vatRegistered ? billForm.vatRate : "0"} disabled={!drawerSupplier?.vatRegistered} onChange={(e) => setBillForm((f) => ({ ...f, vatRate: e.target.value }))}>
                    <option value="0">0% (exempt)</option>
                    <option value="5">5%</option>
                  </Select>
                </Field>
              </div>
              {Number(billForm.amountBeforeVAT) > 0 && (
                <p className="rounded-ctl bg-well px-3 py-2 text-xs text-dim">
                  Total incl. VAT: <strong className="readout text-ink" data-numeric>{fmtAED(Number(billForm.amountBeforeVAT) * (1 + (drawerSupplier?.vatRegistered ? Number(billForm.vatRate) : 0) / 100))}</strong>
                </p>
              )}
            </>
          )}

          {drawer === "payment" && (
            <>
              <Field label="Payment Date" required error={fieldErrors.paymentDate}>
                <DatePicker value={payForm.paymentDate} onChange={(v) => { setPayForm((f) => ({ ...f, paymentDate: v })); setFieldErrors((f) => ({ ...f, paymentDate: undefined })); }} required />
              </Field>
              <Field label="Amount" required error={fieldErrors.amount}>
                <Input required type="number" step="0.01" min="0.01" value={payForm.amount} onChange={(e) => { setPayForm((f) => ({ ...f, amount: e.target.value })); setFieldErrors((f) => ({ ...f, amount: undefined })); }} />
              </Field>
              <Field label="Paid From" required error={fieldErrors.paymentAccountCode}>
                <AccountSelect value={payForm.paymentAccountCode} onChange={(v) => { setPayForm((f) => ({ ...f, paymentAccountCode: v })); setFieldErrors((f) => ({ ...f, paymentAccountCode: undefined })); }} accounts={moneyAccounts.length ? moneyAccounts : accounts} placeholder="Cash / Bank / Petty Cash…" />
              </Field>
              {detail && detail.bills.filter((b) => b.status !== "Paid" && b.status !== "Cancelled").length > 0 && (
                <Field label="Apply to Bill" help="Optional — leave as on-account to apply later">
                  <Select value={payForm.billId} onChange={(e) => setPayForm((f) => ({ ...f, billId: e.target.value }))}>
                    <option value="">— On account —</option>
                    {detail.bills.filter((b) => b.status !== "Paid" && b.status !== "Cancelled").map((b) => (
                      <option key={b.id} value={b.id}>{b.billNumber} · open {fmtNum(b.totalAmount - b.amountPaid)}</option>
                    ))}
                  </Select>
                </Field>
              )}
              <Field label="Reference">
                <Input value={payForm.reference} onChange={(e) => setPayForm((f) => ({ ...f, reference: e.target.value }))} />
              </Field>
              <Field label="Notes">
                <Input value={payForm.notes} onChange={(e) => setPayForm((f) => ({ ...f, notes: e.target.value }))} />
              </Field>
            </>
          )}
        </form>
      </Drawer>
    </div>
  );
}
