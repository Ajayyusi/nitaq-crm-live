"use client";

import { use, useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  ChevronLeft,
  Loader2,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { isReadOnlyRole } from "@/lib/permissions";
import type { AppRole } from "@/lib/permissions";

interface Unit {
  unitCode: string;
  unitTitle: string;
  level: string;
  credits: number | null;
  glh: number | null;
  isMandatory: boolean;
  learningOutcomes: string;
  assessmentCriteria: string;
}

interface Qualification {
  id: string;
  title: string;
  awardingBody: string;
  level: string;
  qualificationCode: string;
  credits: number | null;
  glh: number | null;
  tqt: number | null;
  units: Unit[];
  status: string;
  updatedAt: string;
}

const AWARDING_BODIES = ["Qualifi", "Pearson", "City & Guilds", "OTHM", "ATHE", "Other"];

function emptyUnit(): Unit {
  return { unitCode: "", unitTitle: "", level: "", credits: null, glh: null, isMandatory: true, learningOutcomes: "", assessmentCriteria: "" };
}

export default function QualificationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: session } = useSession();
  const role = ((session?.user as any)?.role ?? "") as AppRole;
  const readOnly = isReadOnlyRole(role) || (role !== "admin" && role !== "manager" && role !== "iqa");

  const [qual, setQual] = useState<Qualification | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  const [title, setTitle] = useState("");
  const [awardingBody, setAwardingBody] = useState("Qualifi");
  const [level, setLevel] = useState("");
  const [qualCode, setQualCode] = useState("");
  const [credits, setCredits] = useState("");
  const [glh, setGlh] = useState("");
  const [tqt, setTqt] = useState("");
  const [status, setStatus] = useState("Active");
  const [units, setUnits] = useState<Unit[]>([]);
  const [addingUnit, setAddingUnit] = useState(false);
  const [newUnit, setNewUnit] = useState<Unit>(emptyUnit());

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/qualifications/${id}`)
      .then((r) => r.json())
      .then((d) => {
        const q: Qualification = d.qualification;
        setQual(q);
        setTitle(q.title);
        setAwardingBody(q.awardingBody);
        setLevel(q.level);
        setQualCode(q.qualificationCode);
        setCredits(q.credits != null ? String(q.credits) : "");
        setGlh(q.glh != null ? String(q.glh) : "");
        setTqt(q.tqt != null ? String(q.tqt) : "");
        setStatus(q.status);
        setUnits(q.units);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(load, [load]);

  const save = async () => {
    setSaving(true); setSaveMsg("");
    try {
      const res = await fetch(`/api/qualifications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title, awardingBody, level, qualificationCode: qualCode,
          credits: credits ? Number(credits) : null,
          glh: glh ? Number(glh) : null,
          tqt: tqt ? Number(tqt) : null,
          status, units,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.message);
      setQual(d.qualification);
      setSaveMsg("Saved.");
      setTimeout(() => setSaveMsg(""), 3000);
    } catch (e) {
      setSaveMsg((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const addUnit = () => {
    if (!newUnit.unitCode.trim() || !newUnit.unitTitle.trim()) return;
    setUnits((prev) => [...prev, { ...newUnit }]);
    setNewUnit(emptyUnit());
    setAddingUnit(false);
  };

  const removeUnit = (idx: number) => setUnits((prev) => prev.filter((_, i) => i !== idx));

  if (loading) return (
    <div className="flex h-64 items-center justify-center text-gray-400">
      <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…
    </div>
  );
  if (!qual) return <div className="p-6 text-center text-gray-500">Qualification not found.</div>;

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div>
        <Link href="/qualifications" className="mb-2 inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400">
          <ChevronLeft className="h-3 w-3" /> Qualifications
        </Link>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">{qual.title}</h1>
        <p className="text-sm text-gray-500">{qual.awardingBody} · Level {qual.level}</p>
      </div>

      {/* Details form */}
      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/5">
        <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">Details</h2>
        {readOnly ? (
          <dl className="space-y-3">
            {[
              ["Title", qual.title], ["Awarding Body", qual.awardingBody], ["Level", qual.level],
              ["Code", qual.qualificationCode || "—"], ["Credits", qual.credits ?? "—"],
              ["GLH", qual.glh ?? "—"], ["TQT", qual.tqt ?? "—"], ["Status", qual.status],
            ].map(([l, v]) => (
              <div key={String(l)} className="flex gap-3">
                <dt className="w-32 text-xs font-semibold text-gray-500 dark:text-gray-400">{l}</dt>
                <dd className="flex-1 text-sm text-gray-800 dark:text-gray-200">{String(v)}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="label">Title</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} className="input-f w-full" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Awarding Body</label>
                <select value={awardingBody} onChange={(e) => setAwardingBody(e.target.value)} className="input-f w-full">
                  {AWARDING_BODIES.map((b) => <option key={b}>{b}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Level</label>
                <input value={level} onChange={(e) => setLevel(e.target.value)} className="input-f w-full" />
              </div>
            </div>
            <div>
              <label className="label">Qualification Code</label>
              <input value={qualCode} onChange={(e) => setQualCode(e.target.value)} className="input-f w-full" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><label className="label">Credits</label><input type="number" value={credits} onChange={(e) => setCredits(e.target.value)} className="input-f w-full" /></div>
              <div><label className="label">GLH</label><input type="number" value={glh} onChange={(e) => setGlh(e.target.value)} className="input-f w-full" /></div>
              <div><label className="label">TQT</label><input type="number" value={tqt} onChange={(e) => setTqt(e.target.value)} className="input-f w-full" /></div>
            </div>
            <div>
              <label className="label">Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)} className="input-f w-full">
                <option>Active</option><option>Inactive</option><option>Pending Approval</option>
              </select>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={save} disabled={saving} className="flex items-center gap-2 rounded-lg bg-[#2E7D32] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1B5E20] disabled:opacity-60">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save
              </button>
              {saveMsg && <span className={`text-sm font-medium ${saveMsg === "Saved." ? "text-green-600" : "text-red-600"}`}>{saveMsg}</span>}
            </div>
          </div>
        )}
      </section>

      {/* Units */}
      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Units ({units.length})
          </h2>
          {!readOnly && !addingUnit && (
            <button
              onClick={() => setAddingUnit(true)}
              className="flex items-center gap-1 text-xs font-semibold text-[#2E7D32] hover:underline dark:text-green-400"
            >
              <Plus className="h-3.5 w-3.5" /> Add Unit
            </button>
          )}
        </div>

        {units.length === 0 && !addingUnit && (
          <p className="text-sm text-gray-400">No units added yet.</p>
        )}

        <div className="space-y-2">
          {units.map((u, idx) => (
            <div key={idx} className="flex items-start gap-3 rounded-lg border border-gray-100 px-4 py-3 dark:border-white/10">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  {u.unitCode} — {u.unitTitle}
                </p>
                <p className="text-xs text-gray-400">
                  {[u.level && `Level ${u.level}`, u.credits && `${u.credits} credits`, u.glh && `${u.glh} GLH`, u.isMandatory ? "Mandatory" : "Optional"].filter(Boolean).join(" · ")}
                </p>
              </div>
              {!readOnly && (
                <button onClick={() => removeUnit(idx)} className="flex-shrink-0 rounded p-1 text-gray-300 hover:text-red-500 dark:hover:text-red-400">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>

        {addingUnit && (
          <div className="mt-3 rounded-xl border border-[#2E7D32]/40 bg-green-50/50 p-4 space-y-3 dark:bg-green-950/20">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Unit Code *</label>
                <input value={newUnit.unitCode} onChange={(e) => setNewUnit((u) => ({ ...u, unitCode: e.target.value }))} className="input-f w-full" placeholder="e.g. U01" />
              </div>
              <div>
                <label className="label">Level</label>
                <input value={newUnit.level} onChange={(e) => setNewUnit((u) => ({ ...u, level: e.target.value }))} className="input-f w-full" />
              </div>
            </div>
            <div>
              <label className="label">Unit Title *</label>
              <input value={newUnit.unitTitle} onChange={(e) => setNewUnit((u) => ({ ...u, unitTitle: e.target.value }))} className="input-f w-full" placeholder="e.g. Managing People" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Credits</label><input type="number" value={newUnit.credits ?? ""} onChange={(e) => setNewUnit((u) => ({ ...u, credits: e.target.value ? Number(e.target.value) : null }))} className="input-f w-full" /></div>
              <div><label className="label">GLH</label><input type="number" value={newUnit.glh ?? ""} onChange={(e) => setNewUnit((u) => ({ ...u, glh: e.target.value ? Number(e.target.value) : null }))} className="input-f w-full" /></div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={newUnit.isMandatory} onChange={(e) => setNewUnit((u) => ({ ...u, isMandatory: e.target.checked }))} className="h-4 w-4 accent-[#2E7D32]" />
              <span className="text-gray-700 dark:text-gray-300">Mandatory unit</span>
            </label>
            <div className="flex gap-2">
              <button onClick={addUnit} className="flex items-center gap-1.5 rounded-lg bg-[#2E7D32] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#1B5E20]">
                <Plus className="h-3.5 w-3.5" /> Add
              </button>
              <button onClick={() => { setAddingUnit(false); setNewUnit(emptyUnit()); }} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50 dark:border-white/10 dark:text-gray-400">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        {!readOnly && units.length > 0 && !addingUnit && (
          <div className="mt-4 flex items-center gap-3">
            <button onClick={save} disabled={saving} className="flex items-center gap-2 rounded-lg bg-[#2E7D32] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1B5E20] disabled:opacity-60">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save Units
            </button>
            {saveMsg && <span className={`text-sm font-medium ${saveMsg === "Saved." ? "text-green-600" : "text-red-600"}`}>{saveMsg}</span>}
          </div>
        )}
      </section>

      <style>{`.label { display:block; margin-bottom:0.25rem; font-size:0.75rem; font-weight:600; color:#4B5563; } .input-f { height:2.25rem; border-radius:0.5rem; border:1px solid #e5e7eb; background:white; padding:0 0.75rem; font-size:0.875rem; outline:none; }`}</style>
    </div>
  );
}
