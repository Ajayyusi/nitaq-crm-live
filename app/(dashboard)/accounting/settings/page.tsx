"use client";

import { useEffect, useState, useCallback } from "react";
import { Save } from "lucide-react";
import DatePicker from "@/components/shared/DatePicker";
import { AccountSelect, usePostingAccounts } from "@/components/accounting/shared";
import BackButton from "@/components/shared/BackButton";
import PageHeader from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Input, Field } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Spinner, PanelLoading, LoadError } from "@/components/ui/feedback";

const MAPPINGS: { key: string; label: string; hint?: string }[] = [
  { key: "defaultCashAccount",   label: "Default Cash Account" },
  { key: "defaultBankAccount",   label: "Default Bank Account" },
  { key: "defaultPosAccount",    label: "POS / Card Collection Account" },
  { key: "tabbyAccount",         label: "Tabby Collection Account" },
  { key: "tamaraAccount",        label: "Tamara Collection Account" },
  { key: "pettyCashAccount",     label: "Petty Cash Account" },
  { key: "accountsReceivable",   label: "Accounts Receivable (Students)" },
  { key: "feesAdvanceAccount",   label: "Fees Received in Advance" },
  { key: "outputVatAccount",     label: "Output VAT" },
  { key: "inputVatAccount",      label: "Input VAT" },
  { key: "defaultRevenueAccount", label: "Default Revenue Account", hint: "Used when a course has no specific mapping" },
  { key: "defaultExpenseAccount", label: "Default Expense Account" },
  { key: "teacherSalaryAccount", label: "Teacher Salary Account", hint: "where teacher payouts post" },
  { key: "discountAccount",      label: "Sales Discount Account", hint: "optional" },
  { key: "refundAccount",        label: "Refund Account", hint: "optional" },
  { key: "badDebtAccount",       label: "Bad Debt Expense", hint: "optional" },
];

export default function AccountingSettingsPage() {
  const { accounts, loading: accountsLoading } = usePostingAccounts();
  const [settings, setSettings] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    setLoadFailed(false);
    fetch("/api/accounting/settings")
      .then((r) => r.json())
      .then((d) => setSettings(d.settings ?? {}))
      .catch(() => setLoadFailed(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  const save = async () => {
    setSaving(true); setMsg("");
    try {
      const res = await fetch("/api/accounting/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.message);
      setSettings(d.settings);
      setMsg("Saved.");
      setTimeout(() => setMsg(""), 3000);
    } catch (err) {
      setMsg((err as Error).message || "Couldn't save. Retry.");
    } finally { setSaving(false); }
  };

  if (loadFailed) {
    return (
      <div className="p-4 sm:p-6">
        <BackButton />
        <LoadError message="Couldn't load accounting settings. Check your connection and retry." onRetry={load} />
      </div>
    );
  }
  if (loading || accountsLoading || !settings) {
    return <PanelLoading label="Loading settings" />;
  }

  return (
    <div className="max-w-3xl space-y-5 p-4 sm:p-6">
      <BackButton />
      <PageHeader
        title="Accounting Settings"
        subtitle="Map CRM operations to Chart of Accounts — nothing is hardcoded"
      />

      {/* VAT */}
      <Card>
        <CardHeader>
          <CardTitle>VAT</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-6">
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" checked={!!settings.vatEnabled} onChange={(e) => setSettings((s) => ({ ...s!, vatEnabled: e.target.checked }))} className="h-4 w-4 accent-phos" />
            VAT enabled (post Output VAT on invoices)
          </label>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-dim">Rate</span>
            <Input
              type="number" min="0" max="100" value={Number(settings.vatRate) || 5}
              onChange={(e) => setSettings((s) => ({ ...s!, vatRate: Number(e.target.value) }))}
              className="w-20"
              aria-label="VAT rate percent"
            />
            <span className="text-faint">%</span>
          </div>
        </CardContent>
      </Card>

      {/* Auto-posting */}
      <Card>
        <CardHeader>
          <CardTitle>Automatic Posting</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {[
            ["autoPostInvoices", "Post invoice entries when enrollments are created"],
            ["autoPostPayments", "Post receipt entries when payments are recorded"],
            ["autoPostExpenses", "Post expense entries when expenses are recorded"],
          ].map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" checked={!!settings[key]} onChange={(e) => setSettings((s) => ({ ...s!, [key]: e.target.checked }))} className="h-4 w-4 accent-phos" />
              {label}
            </label>
          ))}
        </CardContent>
      </Card>

      {/* Period lock */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Books Lock Date</CardTitle>
            <CardDescription className="mt-1">
              No journal entries can be posted on or before this date — set it after closing a period so nobody can change closed months.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <div className="max-w-xs">
            <DatePicker
              value={String(settings.lockDate ?? "")}
              onChange={(v) => setSettings((s) => ({ ...s!, lockDate: v }))}
              placeholder="No lock — all periods open"
            />
          </div>
        </CardContent>
      </Card>

      {/* Account mappings */}
      <Card>
        <CardHeader>
          <CardTitle>Account Mappings</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {MAPPINGS.map((m) => (
            <Field key={m.key} label={m.label} help={m.hint}>
              <AccountSelect
                value={String(settings[m.key] ?? "")}
                onChange={(v) => setSettings((s) => ({ ...s!, [m.key]: v }))}
                accounts={accounts}
                placeholder="— not set —"
              />
            </Field>
          ))}
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button variant="solid" onClick={save} disabled={saving}>
          {saving ? <Spinner className="h-4 w-4" /> : <Save className="h-4 w-4" />} Save Settings
        </Button>
        {msg && (
          <span
            role={msg === "Saved." ? "status" : "alert"}
            className={`text-sm font-medium ${msg === "Saved." ? "text-phos" : "text-alert"}`}
          >
            {msg}
          </span>
        )}
      </div>
    </div>
  );
}
