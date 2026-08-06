"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  ChevronDown, ChevronRight, FolderOpen, Minus, Pencil, Plus, RefreshCw,
} from "lucide-react";
import { fmtNum, type CoaAccount } from "@/components/accounting/shared";
import BackButton from "@/components/shared/BackButton";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import { Button, buttonVariants } from "@/components/ui/button";
import { Lamp } from "@/components/ui/lamp";
import { Drawer } from "@/components/ui/dialog";
import { Input, Select, Field, SearchInput } from "@/components/ui/input";
import { SkeletonRows, LoadError } from "@/components/ui/feedback";

/* Account types keep a stable chart hue for the tree's left-edge accent. */
const TYPE_CHART: Record<string, string> = {
  Asset:     "var(--chart-1)",
  Liability: "var(--chart-2)",
  Equity:    "var(--chart-3)",
  Revenue:   "var(--chart-4)",
  Expense:   "var(--chart-5)",
};

interface TreeNode extends CoaAccount {
  children: TreeNode[];
  depth: number;
}

function buildTree(accounts: CoaAccount[]): TreeNode[] {
  const byCode = new Map<string, TreeNode>();
  for (const a of accounts) byCode.set(a.code, { ...a, children: [], depth: 0 });
  const roots: TreeNode[] = [];
  for (const node of byCode.values()) {
    if (node.parentCode && byCode.has(node.parentCode)) {
      byCode.get(node.parentCode)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  const sortRec = (nodes: TreeNode[], depth: number) => {
    nodes.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
    for (const n of nodes) { n.depth = depth; sortRec(n.children, depth + 1); }
  };
  sortRec(roots, 0);
  return roots;
}

/** Collect codes of all ancestors of accounts matching the search. */
function matchAndAncestors(accounts: CoaAccount[], q: string): { matches: Set<string>; ancestors: Set<string> } {
  const lower = q.toLowerCase();
  const matches = new Set<string>();
  for (const a of accounts) {
    if (a.code.toLowerCase().includes(lower) || a.name.toLowerCase().includes(lower)) matches.add(a.code);
  }
  const byCode = new Map(accounts.map((a) => [a.code, a]));
  const ancestors = new Set<string>();
  for (const code of matches) {
    let cur = byCode.get(code);
    while (cur?.parentCode) {
      ancestors.add(cur.parentCode);
      cur = byCode.get(cur.parentCode);
    }
  }
  return { matches, ancestors };
}

export default function CoaPage() {
  const { data: session } = useSession();
  const role = (session?.user as { role?: string })?.role ?? "";
  const canEdit = role === "admin" || role === "accountant";

  const [accounts, setAccounts] = useState<CoaAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [openNodes, setOpenNodes] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<CoaAccount | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addParent, setAddParent] = useState<CoaAccount | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ code?: string; name?: string }>({});

  const [form, setForm] = useState({ code: "", name: "", type: "Expense", parentCode: "", openingDebit: "", openingCredit: "" });
  const [editForm, setEditForm] = useState({ name: "", isActive: true, openingDebit: "", openingCredit: "" });

  const load = useCallback(() => {
    setLoading(true);
    setLoadError(false);
    fetch("/api/accounting/accounts")
      .then((r) => r.json())
      .then((d) => {
        const list: CoaAccount[] = d.accounts ?? [];
        setAccounts(list);
        // Default: expand the 5 top-level groups only
        setOpenNodes((prev) => prev.size ? prev : new Set(list.filter((a) => !a.parentCode).map((a) => a.code)));
      })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  const filtered = useMemo(
    () => typeFilter ? accounts.filter((a) => a.type === typeFilter) : accounts,
    [accounts, typeFilter]
  );

  const searchInfo = useMemo(
    () => search.trim() ? matchAndAncestors(filtered, search.trim()) : null,
    [filtered, search]
  );

  const tree = useMemo(() => buildTree(filtered), [filtered]);

  // Type summary (top-level totals)
  const summary = useMemo(() => {
    const out: Record<string, number> = {};
    for (const a of accounts) {
      if (!a.isPosting) continue;
      out[a.type] = (out[a.type] ?? 0) + a.closingBalance;
    }
    return out;
  }, [accounts]);

  const toggle = (code: string) =>
    setOpenNodes((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code); else next.add(code);
      return next;
    });

  const expandAll = () => setOpenNodes(new Set(accounts.filter((a) => !a.isPosting).map((a) => a.code)));
  const collapseAll = () => setOpenNodes(new Set(accounts.filter((a) => !a.parentCode).map((a) => a.code)));

  const closeDrawer = () => {
    setAddOpen(false);
    setEditing(null);
    setAddParent(null);
    setFieldErrors({});
    setFormError("");
  };

  const saveNew = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: { code?: string; name?: string } = {};
    if (!form.code.trim()) errs.code = "Enter an account code.";
    if (!form.name.trim()) errs.name = "Enter an account name.";
    if (errs.code || errs.name) { setFieldErrors(errs); return; }
    setSaving(true); setFormError(""); setFieldErrors({});
    try {
      const res = await fetch("/api/accounting/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          openingDebit: Number(form.openingDebit) || 0,
          openingCredit: Number(form.openingCredit) || 0,
          isPosting: true,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.message);
      closeDrawer();
      setForm({ code: "", name: "", type: "Expense", parentCode: "", openingDebit: "", openingCredit: "" });
      load();
    } catch (err) { setFormError((err as Error).message); }
    finally { setSaving(false); }
  };

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    if (!editForm.name.trim()) { setFieldErrors({ name: "Enter an account name." }); return; }
    setSaving(true); setFormError(""); setFieldErrors({});
    try {
      const res = await fetch(`/api/accounting/accounts/${encodeURIComponent(editing.code)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editForm.name, isActive: editForm.isActive,
          openingDebit: Number(editForm.openingDebit) || 0,
          openingCredit: Number(editForm.openingCredit) || 0,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.message);
      closeDrawer();
      load();
    } catch (err) { setFormError((err as Error).message); }
    finally { setSaving(false); }
  };

  const openAdd = (parent?: CoaAccount) => {
    setAddParent(parent ?? null);
    setForm({
      code: "", name: "",
      type: parent?.type ?? "Expense",
      parentCode: parent?.code ?? "",
      openingDebit: "", openingCredit: "",
    });
    setFormError("");
    setFieldErrors({});
    setAddOpen(true);
  };

  const openEdit = (node: CoaAccount) => {
    setEditing(node);
    setEditForm({
      name: node.name,
      isActive: node.isActive,
      openingDebit: String(node.openingDebit || ""),
      openingCredit: String(node.openingCredit || ""),
    });
    setFormError("");
    setFieldErrors({});
  };

  // Render tree rows recursively (respecting search + open state)
  const renderNode = (node: TreeNode): React.ReactNode => {
    if (searchInfo && !searchInfo.matches.has(node.code) && !searchInfo.ancestors.has(node.code)) return null;
    const isOpen = searchInfo ? true : openNodes.has(node.code);
    const hasChildren = node.children.length > 0;
    const isMatch = searchInfo?.matches.has(node.code);

    return (
      <div key={node.code}>
        <div
          className={`flex items-center gap-2 border-l-2 px-2 py-1.5 transition-colors sm:px-3 ${
            !node.isPosting ? "bg-well/60" : "hover:bg-well/40"
          } ${!node.isActive ? "opacity-50" : ""} ${isMatch ? "bg-[var(--lamp-advisory-bg)]" : ""}`}
          style={{ paddingLeft: `${node.depth * 20 + 8}px`, borderLeftColor: TYPE_CHART[node.type] ?? "transparent" }}
        >
          {/* Expand toggle */}
          {hasChildren ? (
            <Button
              variant="ghost" size="iconSm" className="h-6 w-6 flex-shrink-0"
              onClick={() => toggle(node.code)}
              aria-expanded={isOpen}
              aria-label={`${isOpen ? "Collapse" : "Expand"} ${node.name}`}
            >
              {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </Button>
          ) : (
            <span aria-hidden className="grid h-6 w-6 flex-shrink-0 place-items-center text-faint"><Minus className="h-3 w-3" /></span>
          )}

          {/* Name + code */}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              {node.isPosting ? (
                <Link href={`/accounting/ledger?account=${encodeURIComponent(node.code)}`}
                  className="truncate text-sm text-ink underline-offset-2 hover:text-phos hover:underline">
                  {node.name}
                </Link>
              ) : (
                <button onClick={() => toggle(node.code)} className="flex items-center gap-1.5 truncate text-sm font-bold text-ink">
                  <FolderOpen aria-hidden className="h-3.5 w-3.5 flex-shrink-0 text-faint" />
                  {node.name}
                </button>
              )}
              <span className="readout text-[10px] text-faint" data-numeric>{node.code}</span>
              {!node.isActive && <Lamp variant="off">Inactive</Lamp>}
              {hasChildren && !isOpen && (
                <span className="readout rounded-lamp bg-well px-1.5 py-0.5 text-[10px] font-semibold text-faint" data-numeric>{node.children.length}</span>
              )}
            </div>
          </div>

          {/* Balance */}
          <span className={`readout whitespace-nowrap text-sm ${
            !node.isPosting ? "font-bold text-ink" :
            node.closingBalance === 0 ? "text-faint" :
            node.closingBalance < 0 ? "font-semibold text-alert" : "font-semibold text-ink"
          }`} data-numeric>
            {fmtNum(node.closingBalance)}
          </span>

          {/* Row actions — always visible so keyboard and touch can reach them */}
          {canEdit && (
            <div className="flex flex-shrink-0 items-center gap-0.5">
              {!node.isPosting && (
                <Button variant="ghost" size="iconSm" className="h-7 w-7" onClick={() => openAdd(node)}
                  aria-label={`Add account under ${node.name}`} title="Add account here">
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              )}
              {node.isPosting && (
                <Button variant="ghost" size="iconSm" className="h-7 w-7" onClick={() => openEdit(node)}
                  aria-label={`Edit ${node.name}`} title="Edit">
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          )}
        </div>
        {hasChildren && isOpen && <div>{node.children.map(renderNode)}</div>}
      </div>
    );
  };

  return (
    <div className="p-4 sm:p-6">
      <BackButton />
      <PageHeader
        title="Chart of Accounts"
        subtitle={`${accounts.filter((a) => a.isPosting).length} posting accounts in ${accounts.filter((a) => !a.isPosting).length} groups`}
        actions={
          <>
            <Button variant="ghost" size="icon" onClick={load} aria-label="Refresh accounts">
              <RefreshCw className="h-4 w-4" />
            </Button>
            {canEdit && (
              <Button variant="solid" onClick={() => openAdd()}>
                <Plus className="h-4 w-4" /> Add Account
              </Button>
            )}
          </>
        }
      />

      <div className="space-y-5">
        {/* Type summary cards */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {(["Asset", "Liability", "Equity", "Revenue", "Expense"] as const).map((t) => (
            <button
              key={t} type="button"
              onClick={() => setTypeFilter(typeFilter === t ? "" : t)}
              aria-pressed={typeFilter === t}
              className={`face p-3 text-left transition-all duration-150 ${typeFilter === t ? "border-phos ring-2 ring-phos/25" : "hover:border-bezel-strong"}`}
            >
              <span className="flex items-center gap-1.5">
                <span aria-hidden className="h-2 w-2 flex-shrink-0 rounded-sm" style={{ background: TYPE_CHART[t] }} />
                <span className="placard">{t}s</span>
              </span>
              <p className="readout mt-1.5 truncate text-sm font-bold text-ink" data-numeric>{fmtNum(Math.abs(summary[t] ?? 0))}</p>
            </button>
          ))}
        </div>

        {/* Search + expand controls */}
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput
            placeholder="Search accounts…"
            aria-label="Search accounts"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="min-w-[200px] flex-1"
          />
          <Button variant="secondary" size="sm" onClick={expandAll}>Expand All</Button>
          <Button variant="secondary" size="sm" onClick={collapseAll}>Collapse All</Button>
        </div>

        {/* Tree */}
        {loading ? (
          <div className="face"><SkeletonRows rows={10} cols={3} /></div>
        ) : loadError ? (
          <LoadError message="Couldn't load the Chart of Accounts." onRetry={load} />
        ) : tree.length === 0 ? (
          <div className="face">
            <EmptyState
              icon={FolderOpen}
              title="No accounts yet"
              description="Seed the Chart of Accounts from the Accounting overview to get started."
              action={
                <Link href="/accounting" className={buttonVariants({ variant: "primary", size: "sm" })}>
                  Open Accounting
                </Link>
              }
            />
          </div>
        ) : (
          <div className="face overflow-hidden">
            <div className="flex items-center justify-between border-b border-bezel bg-well px-4 py-2">
              <span className="placard">Account</span>
              <span className="placard">Closing Balance</span>
            </div>
            <div className="divide-y divide-bezel/60">
              {tree.map(renderNode)}
            </div>
          </div>
        )}
      </div>

      {/* Add / Edit drawer — guarded: a stray backdrop click won't discard the form */}
      <Drawer
        open={addOpen || !!editing}
        onClose={closeDrawer}
        title={editing ? `Edit ${editing.code}` : addParent ? `Add under ${addParent.name}` : "Add Account"}
        footer={
          <Button type="submit" form="coa-form" variant="solid" disabled={saving} className="w-full">
            {saving ? "Saving…" : editing ? "Save Changes" : "Create Account"}
          </Button>
        }
      >
        <form id="coa-form" onSubmit={editing ? saveEdit : saveNew} noValidate className="space-y-4">
          {formError && (
            <p role="alert" className="rounded-ctl border border-alert/30 bg-[var(--lamp-alert-bg)] px-3 py-2 text-sm font-semibold text-alert">
              {formError}
            </p>
          )}
          {!editing && (
            <>
              {addParent && (
                <p className="rounded-ctl border border-advisory/30 bg-[var(--lamp-advisory-bg)] px-3 py-2 text-xs text-advisory">
                  Parent: <strong>{addParent.code} — {addParent.name}</strong> ({addParent.type})
                </p>
              )}
              <Field label="Account Code" required error={fieldErrors.code} htmlFor="coa-code">
                <Input
                  id="coa-code"
                  value={form.code}
                  onChange={(e) => { setForm((f) => ({ ...f, code: e.target.value })); setFieldErrors((fe) => ({ ...fe, code: undefined })); }}
                  placeholder="e.g. 5010010049"
                />
              </Field>
              {!addParent && (
                <>
                  <Field label="Type" required htmlFor="coa-type">
                    <Select id="coa-type" value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
                      {["Asset", "Liability", "Equity", "Revenue", "Expense"].map((t) => <option key={t}>{t}</option>)}
                    </Select>
                  </Field>
                  <Field label="Parent Account Code" help="Optional, e.g. 5" htmlFor="coa-parent">
                    <Input id="coa-parent" value={form.parentCode} onChange={(e) => setForm((f) => ({ ...f, parentCode: e.target.value }))} />
                  </Field>
                </>
              )}
            </>
          )}
          <Field label="Account Name" required error={fieldErrors.name} htmlFor="coa-name">
            <Input
              id="coa-name"
              value={editing ? editForm.name : form.name}
              onChange={(e) => {
                const v = e.target.value;
                if (editing) setEditForm((f) => ({ ...f, name: v })); else setForm((f) => ({ ...f, name: v }));
                setFieldErrors((fe) => ({ ...fe, name: undefined }));
              }}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Opening Debit" htmlFor="coa-od">
              <Input id="coa-od" type="number" step="0.01" min="0" inputMode="decimal"
                value={editing ? editForm.openingDebit : form.openingDebit}
                onChange={(e) => editing ? setEditForm((f) => ({ ...f, openingDebit: e.target.value })) : setForm((f) => ({ ...f, openingDebit: e.target.value }))} />
            </Field>
            <Field label="Opening Credit" htmlFor="coa-oc">
              <Input id="coa-oc" type="number" step="0.01" min="0" inputMode="decimal"
                value={editing ? editForm.openingCredit : form.openingCredit}
                onChange={(e) => editing ? setEditForm((f) => ({ ...f, openingCredit: e.target.value })) : setForm((f) => ({ ...f, openingCredit: e.target.value }))} />
            </Field>
          </div>
          {editing && (
            <label className="flex cursor-pointer items-center gap-2 text-sm text-ink">
              <input type="checkbox" checked={editForm.isActive} onChange={(e) => setEditForm((f) => ({ ...f, isActive: e.target.checked }))} className="h-4 w-4 accent-phos" />
              Active
            </label>
          )}
        </form>
      </Drawer>
    </div>
  );
}
