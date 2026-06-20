"use client";

import { use, useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  Loader2,
  MessageSquarePlus,
  Save,
  XCircle,
} from "lucide-react";
import { isReadOnlyRole } from "@/lib/permissions";
import type { AppRole } from "@/lib/permissions";

interface Document {
  docType: string;
  label: string;
  status: string;
  expiryDate: string;
  uploadRef: string;
  verifiedBy: string;
  notes: string;
}

interface CommsEntry {
  note: string;
  by: string;
  at: string;
}

interface Profile {
  id: string;
  enrollmentId: string;
  fullName: string;
  phone: string;
  email: string;
  emiratesId: string;
  emiratesIdExpiry: string;
  passportNumber: string;
  passportExpiry: string;
  visaNumber: string;
  visaExpiry: string;
  nationality: string;
  dateOfBirth: string;
  photoOnFile: boolean;
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactRelation: string;
  riskStatus: "Low" | "Medium" | "High";
  riskNotes: string;
  documents: Document[];
  commsLog: CommsEntry[];
  docCompletionPct: number;
  missingRequiredDocs: string[];
  isActive: boolean;
}

const docStatusOptions = ["Present", "Missing", "Expired", "Pending Review"];
const docStatusColor: Record<string, string> = {
  Present:        "text-green-600 dark:text-green-400",
  Missing:        "text-red-600 dark:text-red-400",
  Expired:        "text-amber-600 dark:text-amber-400",
  "Pending Review": "text-blue-600 dark:text-blue-400",
};

const riskColors = {
  Low:    "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  Medium: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  High:   "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function LearnerProfileDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: session } = useSession();
  const role = ((session?.user as any)?.role ?? "") as AppRole;
  const readOnly = isReadOnlyRole(role);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  // Form state
  const [riskStatus, setRiskStatus] = useState<"Low" | "Medium" | "High">("Low");
  const [riskNotes, setRiskNotes] = useState("");
  const [photoOnFile, setPhotoOnFile] = useState(false);
  const [docs, setDocs] = useState<Document[]>([]);
  const [commsNote, setCommsNote] = useState("");
  const [postingComms, setPostingComms] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/learner-profiles/${id}`)
      .then((r) => r.json())
      .then((d) => {
        const p: Profile = d.profile;
        setProfile(p);
        setRiskStatus(p.riskStatus);
        setRiskNotes(p.riskNotes);
        setPhotoOnFile(p.photoOnFile);
        setDocs(p.documents);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(load, [load]);

  const saveRisk = async () => {
    setSaving(true);
    setSaveMsg("");
    try {
      const res = await fetch(`/api/learner-profiles/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ riskStatus, riskNotes, photoOnFile, documents: docs }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.message);
      setProfile(d.profile);
      setSaveMsg("Saved.");
      setTimeout(() => setSaveMsg(""), 3000);
    } catch (e) {
      setSaveMsg((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const appendComms = async () => {
    if (!commsNote.trim()) return;
    setPostingComms(true);
    try {
      const res = await fetch(`/api/learner-profiles/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appendComms: commsNote.trim() }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.message);
      setProfile(d.profile);
      setCommsNote("");
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setPostingComms(false);
    }
  };

  const updateDocStatus = (docType: string, status: string) => {
    setDocs((prev) =>
      prev.map((d) => (d.docType === docType ? { ...d, status } : d))
    );
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-gray-400">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…
      </div>
    );
  }
  if (!profile) {
    return (
      <div className="p-6 text-center text-gray-500">Profile not found.</div>
    );
  }

  const requiredDocTypes = ["Emirates ID", "Passport", "Visa"];

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href="/learner-profiles"
            className="mb-2 inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <ChevronLeft className="h-3 w-3" /> Learner Profiles
          </Link>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">{profile.fullName}</h1>
          <p className="text-sm text-gray-500">{profile.phone} · {profile.email || "—"}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-sm font-semibold ${riskColors[profile.riskStatus]}`}>
          {profile.riskStatus} Risk
        </span>
      </div>

      {/* Doc completion banner */}
      <div className={`rounded-xl border p-4 ${profile.docCompletionPct === 100 ? "border-green-200 bg-green-50 dark:border-green-800/40 dark:bg-green-950/20" : "border-amber-200 bg-amber-50 dark:border-amber-800/40 dark:bg-amber-950/20"}`}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Document Completion</span>
          <span className="text-sm font-bold text-gray-900 dark:text-white">{profile.docCompletionPct}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-white/60 dark:bg-white/10">
          <div
            className={`h-full rounded-full ${profile.docCompletionPct === 100 ? "bg-green-500" : "bg-amber-500"}`}
            style={{ width: `${profile.docCompletionPct}%` }}
          />
        </div>
        {profile.missingRequiredDocs.length > 0 && (
          <p className="mt-2 flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400">
            <AlertTriangle className="h-3 w-3" />
            Missing: {profile.missingRequiredDocs.join(", ")}
          </p>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Personal details */}
        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/5">
          <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">Personal Details</h2>
          <dl className="space-y-3">
            <DetailRow label="Nationality" value={profile.nationality} />
            <DetailRow label="Date of Birth" value={profile.dateOfBirth} />
            <DetailRow label="Emirates ID" value={profile.emiratesId} sub={profile.emiratesIdExpiry ? `Expires ${profile.emiratesIdExpiry}` : ""} />
            <DetailRow label="Passport" value={profile.passportNumber} sub={profile.passportExpiry ? `Expires ${profile.passportExpiry}` : ""} />
            <DetailRow label="Visa" value={profile.visaNumber} sub={profile.visaExpiry ? `Expires ${profile.visaExpiry}` : ""} />
            {profile.emergencyContactName && (
              <DetailRow
                label="Emergency Contact"
                value={`${profile.emergencyContactName} (${profile.emergencyContactRelation})`}
                sub={profile.emergencyContactPhone}
              />
            )}
          </dl>
        </section>

        {/* Risk + Photo */}
        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/5">
          <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">Risk Assessment</h2>
          {readOnly ? (
            <div className="space-y-3">
              <DetailRow label="Risk Level" value={profile.riskStatus} />
              <DetailRow label="Notes" value={profile.riskNotes || "—"} />
              <DetailRow label="Photo on File" value={profile.photoOnFile ? "Yes" : "No"} />
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-600 dark:text-gray-400">Risk Level</label>
                <select
                  value={riskStatus}
                  onChange={(e) => setRiskStatus(e.target.value as "Low" | "Medium" | "High")}
                  className="h-9 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm outline-none ring-[#2E7D32] focus:ring-2 dark:border-white/10 dark:bg-white/5 dark:text-white"
                >
                  <option>Low</option>
                  <option>Medium</option>
                  <option>High</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-600 dark:text-gray-400">Risk Notes</label>
                <textarea
                  rows={3}
                  value={riskNotes}
                  onChange={(e) => setRiskNotes(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none ring-[#2E7D32] focus:ring-2 dark:border-white/10 dark:bg-white/5 dark:text-white"
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={photoOnFile}
                  onChange={(e) => setPhotoOnFile(e.target.checked)}
                  className="h-4 w-4 rounded accent-[#2E7D32]"
                />
                <span className="text-gray-700 dark:text-gray-300">Photo on file</span>
              </label>
            </div>
          )}
        </section>
      </div>

      {/* Document checklist */}
      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/5">
        <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">Document Checklist</h2>
        {requiredDocTypes.length === 0 && docs.length === 0 ? (
          <p className="text-sm text-gray-400">No documents.</p>
        ) : (
          <div className="space-y-3">
            {/* Required docs derived from profile (always show) */}
            {requiredDocTypes.map((docType) => {
              const existing = docs.find((d) => d.docType === docType);
              const status = existing?.status ?? "Missing";
              return (
                <div key={docType} className="flex items-center gap-3 rounded-lg border border-gray-100 px-4 py-2.5 dark:border-white/10">
                  <span className="flex-1 text-sm font-medium text-gray-800 dark:text-gray-200">{docType}</span>
                  {readOnly ? (
                    <span className={`text-xs font-semibold ${docStatusColor[status] ?? ""}`}>{status}</span>
                  ) : (
                    <select
                      value={status}
                      onChange={(e) => {
                        if (existing) {
                          updateDocStatus(docType, e.target.value);
                        } else {
                          setDocs((prev) => [...prev, { docType, label: "", status: e.target.value, expiryDate: "", uploadRef: "", verifiedBy: "", notes: "" }]);
                        }
                      }}
                      className={`h-8 rounded-lg border border-gray-200 bg-white px-2 text-xs font-semibold outline-none dark:border-white/10 dark:bg-white/5 ${docStatusColor[status] ?? ""}`}
                    >
                      {docStatusOptions.map((s) => <option key={s}>{s}</option>)}
                    </select>
                  )}
                  {status === "Present" ? (
                    <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-green-500" />
                  ) : (
                    <XCircle className="h-4 w-4 flex-shrink-0 text-red-400" />
                  )}
                </div>
              );
            })}
            {/* Extra docs */}
            {docs.filter((d) => !requiredDocTypes.includes(d.docType)).map((d) => (
              <div key={d.docType} className="flex items-center gap-3 rounded-lg border border-gray-100 px-4 py-2.5 dark:border-white/10">
                <span className="flex-1 text-sm text-gray-700 dark:text-gray-300">{d.label || d.docType}</span>
                <span className={`text-xs font-semibold ${docStatusColor[d.status] ?? ""}`}>{d.status}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Save button */}
      {!readOnly && (
        <div className="flex items-center gap-3">
          <button
            onClick={saveRisk}
            disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-[#2E7D32] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#1B5E20] disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Changes
          </button>
          {saveMsg && (
            <span className={`text-sm font-medium ${saveMsg === "Saved." ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
              {saveMsg}
            </span>
          )}
        </div>
      )}

      {/* Communications log */}
      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/5">
        <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Communications Log ({profile.commsLog.length})
        </h2>
        {!readOnly && (
          <div className="mb-4 flex gap-2">
            <input
              type="text"
              placeholder="Add a communication note…"
              value={commsNote}
              onChange={(e) => setCommsNote(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && appendComms()}
              className="flex-1 h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm outline-none ring-[#2E7D32] focus:ring-2 dark:border-white/10 dark:bg-white/5 dark:text-white"
            />
            <button
              onClick={appendComms}
              disabled={postingComms || !commsNote.trim()}
              className="flex items-center gap-1.5 rounded-lg bg-[#2E7D32] px-3.5 py-2 text-sm font-semibold text-white disabled:opacity-60 hover:bg-[#1B5E20]"
            >
              {postingComms ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquarePlus className="h-4 w-4" />}
              Add
            </button>
          </div>
        )}
        {profile.commsLog.length === 0 ? (
          <p className="text-sm text-gray-400">No communications logged yet.</p>
        ) : (
          <div className="space-y-2">
            {[...profile.commsLog].reverse().map((entry, i) => (
              <div key={i} className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-2.5 dark:border-white/10 dark:bg-white/[0.03]">
                <p className="text-sm text-gray-800 dark:text-gray-200">{entry.note}</p>
                <p className="mt-1 text-[11px] text-gray-400">
                  {entry.by} · <span title={new Date(entry.at).toLocaleString()}>{timeAgo(entry.at)}</span>
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function DetailRow({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex gap-3">
      <dt className="w-32 flex-shrink-0 text-xs font-semibold text-gray-500 dark:text-gray-400">{label}</dt>
      <dd className="flex-1 text-sm text-gray-800 dark:text-gray-200">
        {value || "—"}
        {sub && <span className="block text-xs text-gray-400">{sub}</span>}
      </dd>
    </div>
  );
}
