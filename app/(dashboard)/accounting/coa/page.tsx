"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  ChevronDown, ChevronLeft, ChevronRight, FolderOpen, Loader2,
  Minus, Pencil, Plus, RefreshCw, Search, X,
} from "lucide-react";
import { fmtNum, type CoaAccount } from "@/components/accounting/shared";
import BackButton from "@/components/shared/BackButton";

const typeBadge: Record<string, string> = {
  Asset:     "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  Liability: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  Equity:    "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
  Revenue:   "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  Expense:   "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
};

const typeAccent: Record<string, string> = {
  Asset:     "border-l-blue-400",
  Liability: "border-l-amber-400",
  Equity:    "border-l-purple-400",
  Revenue:   "border-l-green-400",
  Expense:   "border-l-red-400",
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
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [openNodes, setOpenNodes] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<CoaAccount | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addParent, setAddParent] = useState<CoaAccount | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [form, setForm] = useState({ code: "", name: "", type: "Expense", parentCode: "", openingDebit: "", openingCredit: "" });
  const [editForm, setEditForm] = useState({ name: "", isActive: true, openingDebit: "", openingCredit: "" });

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/accounting/accounts")
      .then((r) => r.json())
      .then((d) => {
        const list: CoaAccount[] = d.accounts ?? [];
        setAccounts(list);
        // Default: expand the 5 top-level groups only
        setOpenNodes((prev) => prev.size ? prev : new Set(list.filter((a) => !a.parentCode).map((a) => a.code)));
      })
      .catch(() => {})
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

  const saveNew = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setFormError("");
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
      setAddOpen(false); setAddParent(null);
      setForm({ code: "", name: "", type: "Expense", parentCode: "", openingDebit: "", openingCredit: "" });
      load();
    } catch (err) { setFormError((err as Error).message); }
    finally { setSaving(false); }
  };

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setSaving(true); setFormError("");
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
      setEditing(null);
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
    setAddOpen(true);
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
          className={`group flex items-center gap-2 border-l-2 px-2 py-2 transition sm:px-3 ${typeAccent[node.type] ?? "border-l-transparent"} ${
            !node.isPosting
              ? "bg-gray-50/80 dark:bg-white/[0.04]"
              : "hover:bg-[#E8F5E9]/50 dark:hover:bg-green-900/10"
          } ${!node.isActive ? "opacity-50" : ""} ${isMatch ? "bg-yellow-50 dark:bg-yellow-900/10" : ""}`}
          style={{ paddingLeft: `${node.depth * 20 + 8}px` }}
        >
          {/* Expand toggle */}
          {hasChildren ? (
            <button onClick={() => toggle(node.code)} className="grid h-6 w-6 flex-shrink-0 place-items-center rounded-md text-gray-400 hover:bg-white hover:text-[#2E7D32] hover:shadow-sm dark:hover:bg-white/10">
              {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
          ) : (
            <span className="grid h-6 w-6 flex-shrink-0 place-items-center text-gray-200 dark:text-gray-700"><Minus className="h-3 w-3" /></span>
          )}

          {/* Name + code */}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2">
              {node.isPosting ? (
                <Link href={`/accounting/ledger?account=${encodeURIComponent(node.code)}`}
                  className="truncate text-sm text-gray-800 hover:text-[#2E7D32] hover:underline dark:text-gray-200 dark:hover:text-green-400">
                  {node.name}
                </Link>
              ) : (
                <button onClick={() => toggle(node.code)} className="flex items-center gap-1.5 truncate text-sm font-bold text-gray-900 dark:text-white">
                  <FolderOpen className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
                  {node.name}
                </button>
              )}
              <span className="font-mono text-[10px] text-gray-400">{node.code}</span>
              {!node.isActive && <span className="rounded bg-red-100 px-1.5 text-[9px] font-bold text-red-500 dark:bg-red-900/40">INACTIVE</span>}
              {hasChildren && !isOpen && (
                <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-400 dark:bg-white/10">{node.children.length}</span>
              )}
            </div>
          </div>

          {/* Balance */}
          <span className={`whitespace-nowrap text-sm tabular-nums ${
            !node.isPosting ? "font-bold text-gray-900 dark:text-white" :
            node.closingBalance === 0 ? "text-gray-300 dark:text-gray-600" :
            node.closingBalance < 0 ? "font-semibold text-red-600 dark:text-red-400" : "font-semibold text-gray-700 dark:text-gray-300"
          }`}>
            {fmtNum(node.closingBalance)}
          </span>

          {/* Row actions */}
          {canEdit && (
            <div className="flex flex-shrink-0 items-center gap-0.5 opacity-0 transition group-hover:opacity-100">
              {!node.isPosting && (
                <button title="Add account here" onClick={() => openAdd(node)} className="rounded p-1 text-gray-300 hover:bg-white hover:text-[#2E7D32] hover:shadow-sm dark:hover:bg-white/10">
                  <Plus className="h-3.5 w-3.5" />
                </button>
              )}
              {node.isPosting && (
                <button title="Edit" onClick={() => { setEditing(node); setEditForm({ name: node.name, isActive: node.isActive, openingDebit: String(node.openingDebit || ""), openingCredit: String(node.openingCredit || "") }); setFormError(""); }}
                  className="rounded p-1 text-gray-300 hover:bg-white hover:text-[#2E7D32] hover:shadow-sm dark:hover:bg-white/10">
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )}
        </div>
        {hasChildren && isOpen && <div>{node.children.map(renderNode)}</div>}
      </div>
    );
  };

  const inp = "h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-[#2E7D32] dark:border-white/10 dark:bg-white/5 dark:text-white";

  return (
    <div className="space-y-5 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <BackButton />
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Chart of Accounts</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{accounts.filter((a) => a.isPosting).length} posting accounts in {accounts.filter((a) => !a.isPosting).length} groups</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="grid h-9 w-9 place-items-center rounded-lg border border-gray-200 bg-white text-gray-500 shadow-sm hover:bg-gray-50 dark:border-white/10 dark:bg-white/5"><RefreshCw className="h-4 w-4" /></button>
          {canEdit && (
            <button onClick={() => openAdd()} className="flex items-center gap-1.5 rounded-lg bg-[#2E7D32] px-3.5 py-2 text-sm font-semibold text-white hover:bg-[#1B5E20]">
              <Plus className="h-4 w-4" /> Add Account
            </button>
          )}
        </div>
      </div>

      {/* Type summary cards */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {(["Asset", "Liability", "Equity", "Revenue", "Expense"] as const).map((t) => (
          <button key={t} onClick={() => setTypeFilter(typeFilter === t ? "" : t)}
            className={`rounded-xl border p-3 text-left shadow-sm transition ${typeFilter === t ? "border-[#2E7D32] ring-2 ring-[#2E7D32]/30" : "border-gray-200 dark:border-white/10"} bg-white dark:bg-white/5`}>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${typeBadge[t]}`}>{t}s</span>
            <p className="mt-1.5 truncate text-sm font-extrabold tabular-nums text-gray-900 dark:text-white">{fmtNum(Math.abs(summary[t] ?? 0))}</p>
          </button>
        ))}
      </div>

      {/* Search + expand controls */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input placeholder="Search accounts…" value={search} onChange={(e) => setSearch(e.target.value)} className={`${inp} pl-9`} />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-600"><X className="h-4 w-4" /></button>
          )}
        </div>
        <button onClick={expandAll} className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50 dark:border-white/10 dark:bg-white/5 dark:text-gray-400">Expand All</button>
        <button onClick={collapseAll} className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50 dark:border-white/10 dark:bg-white/5 dark:text-gray-400">Collapse All</button>
      </div>

      {/* Tree */}
      {loading ? (
        <div className="flex h-40 items-center justify-center text-gray-400"><Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…</div>
      ) : tree.length === 0 ? (
        <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-gray-200 text-sm text-gray-400 dark:border-white/10">
          No accounts. Seed the Chart of Accounts from the Accounting dashboard.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/5">
          <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:border-white/10 dark:bg-white/5">
            <span>Account</span>
            <span>Closing Balance</span>
          </div>
          <div className="divide-y divide-gray-50 dark:divide-white/5">
            {tree.map(renderNode)}
          </div>
        </div>
      )}

      {/* Add / Edit drawer */}
      {(addOpen || editing) && (
        <div className="fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/40" onClick={() => { setAddOpen(false); setEditing(null); setAddParent(null); }} />
          <aside className="relative ml-auto flex h-full w-full max-w-md flex-col bg-white shadow-2xl dark:bg-[#0D1F0E]">
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-white/10">
              <h2 className="font-bold text-gray-900 dark:text-white">
                {editing ? `Edit ${editing.code}` : addParent ? `Add under ${addParent.name}` : "Add Account"}
              </h2>
              <button onClick={() => { setAddOpen(false); setEditing(null); setAddParent(null); }} className="rounded-lg p-1.5 hover:bg-gray-100 dark:hover:bg-white/10"><X className="h-4 w-4 text-gray-500" /></button>
            </div>
            <form onSubmit={editing ? saveEdit : saveNew} className="flex-1 space-y-4 overflow-y-auto p-5">
              {formError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-400">{formError}</p>}
              {!editing && (
                <>
                  {addParent && (
                    <p className="rounded-lg bg-[#E8F5E9] px-3 py-2 text-xs text-[#1B5E20] dark:bg-green-900/30 dark:text-green-300">
                      Parent: <strong>{addParent.code} — {addParent.name}</strong> ({addParent.type})
                    </p>
                  )}
                  <div><label className="label-x">Account Code *</label><input required value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} className={inp} placeholder="e.g. 5010010049" /></div>
                  {!addParent && (
                    <>
                      <div><label className="label-x">Type *</label>
                        <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))} className={inp}>
                          {["Asset", "Liability", "Equity", "Revenue", "Expense"].map((t) => <option key={t}>{t}</option>)}
                        </select>
                      </div>
                      <div><label className="label-x">Parent Account Code</label><input value={form.parentCode} onChange={(e) => setForm((f) => ({ ...f, parentCode: e.target.value }))} className={inp} placeholder="optional, e.g. 5" /></div>
                    </>
                  )}
                </>
              )}
              <div><label className="label-x">Account Name *</label>
                <input required value={editing ? editForm.name : form.name}
                  onChange={(e) => editing ? setEditForm((f) => ({ ...f, name: e.target.value })) : setForm((f) => ({ ...f, name: e.target.value }))}
                  className={inp} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label-x">Opening Debit</label>
                  <input type="number" step="0.01" min="0" value={editing ? editForm.openingDebit : form.openingDebit}
                    onChange={(e) => editing ? setEditForm((f) => ({ ...f, openingDebit: e.target.value })) : setForm((f) => ({ ...f, openingDebit: e.target.value }))} className={inp} />
                </div>
                <div><label className="label-x">Opening Credit</label>
                  <input type="number" step="0.01" min="0" value={editing ? editForm.openingCredit : form.openingCredit}
                    onChange={(e) => editing ? setEditForm((f) => ({ ...f, openingCredit: e.target.value })) : setForm((f) => ({ ...f, openingCredit: e.target.value }))} className={inp} />
                </div>
              </div>
              {editing && (
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={editForm.isActive} onChange={(e) => setEditForm((f) => ({ ...f, isActive: e.target.checked }))} className="h-4 w-4 accent-[#2E7D32]" />
                  <span className="text-gray-700 dark:text-gray-300">Active</span>
                </label>
              )}
              <button type="submit" disabled={saving} className="w-full rounded-lg bg-[#2E7D32] py-2.5 text-sm font-semibold text-white hover:bg-[#1B5E20] disabled:opacity-60">
                {saving ? "Saving…" : editing ? "Save Changes" : "Create Account"}
              </button>
            </form>
          </aside>
        </div>
      )}
      <style>{`.label-x { display:block; margin-bottom:0.25rem; font-size:0.75rem; font-weight:600; color:#4B5563; }`}</style>
    </div>
  );
}
