"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Clock, Loader2, X, MessageCircle } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import { useSession } from "next-auth/react";

type EnrollmentRequest = {
  id: string;
  leadRef: string;
  leadName: string;
  leadPhone: string;
  course: string;
  salesName: string;
  salesEmail: string;
  notes: string;
  expectedStartDate: string;
  status: string;
  reviewedBy: string;
  reviewNote: string;
  reviewedAt: string;
  createdAt: string;
};

const statusCls: Record<string, string> = {
  Pending: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  Approved: "bg-green-50 text-green-700 ring-1 ring-green-200",
  Rejected: "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
  "More Info Needed": "bg-blue-50 text-blue-700 ring-1 ring-blue-200",
};

function formatDate(s: string) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export default function EnrollmentRequestsPage() {
  const { data: session } = useSession();
  const rawRole = (session?.user as { role?: string })?.role ?? "sales";
  const role = rawRole === "staff" ? "sales" : rawRole;
  const isSales = role === "sales";

  const [requests, setRequests] = useState<EnrollmentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reviewing, setReviewing] = useState<EnrollmentRequest | null>(null);
  const [reviewStatus, setReviewStatus] = useState("Approved");
  const [reviewNote, setReviewNote] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/enrollment-requests");
      const data = await res.json();
      if (!res.ok) throw data;
      setRequests(data.requests ?? []);
    } catch {
      setError("Unable to load requests.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function submitReview(e: React.FormEvent) {
    e.preventDefault();
    if (!reviewing) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/enrollment-requests/${reviewing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: reviewStatus, reviewNote }),
      });
      const data = await res.json();
      if (!res.ok) throw data;
      setNotice(`Request for ${reviewing.leadName} marked as ${reviewStatus}.`);
      setReviewing(null);
      await load();
    } catch {
      setError("Failed to update request.");
    } finally {
      setSaving(false);
    }
  }

  const pending = requests.filter((r) => r.status === "Pending");
  const others = requests.filter((r) => r.status !== "Pending");

  return (
    <div className="space-y-6">
      <PageHeader
        title={isSales ? "My Enrollment Requests" : "Enrollment Requests"}
        subtitle={isSales
          ? "Track enrollment requests you've submitted to Admin/Manager."
          : "Review enrollment requests from Sales staff."}
      />

      {notice && (
        <div className="flex items-center justify-between rounded-xl border border-green-200 bg-[#E8F5E9] px-4 py-3 text-sm font-semibold text-[#2E7D32]">
          <span>{notice}</span>
          <button onClick={() => setNotice("")} type="button"><X className="h-4 w-4" /></button>
        </div>
      )}
      {error && (
        <div className="flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">
          <span>{error}</span>
          <button onClick={() => setError("")} type="button"><X className="h-4 w-4" /></button>
        </div>
      )}

      {/* Review modal (admin/manager only) */}
      {reviewing && !isSales && (
        <>
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" onClick={() => setReviewing(null)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
              <div className="border-b border-slate-200 bg-[#0D1F0E] px-6 py-5 rounded-t-2xl text-white">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold">Review Request — {reviewing.leadName}</h2>
                  <button onClick={() => setReviewing(null)} className="grid h-8 w-8 place-items-center rounded-lg bg-white/10 hover:bg-white/20" type="button">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <form onSubmit={submitReview} className="p-6 space-y-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-1 text-sm">
                  <p><span className="font-bold text-slate-600">Lead:</span> <span className="text-slate-900">{reviewing.leadName}</span></p>
                  <p><span className="font-bold text-slate-600">Phone:</span> <span className="text-slate-900">{reviewing.leadPhone}</span></p>
                  <p><span className="font-bold text-slate-600">Course:</span> <span className="text-slate-900">{reviewing.course}</span></p>
                  <p><span className="font-bold text-slate-600">Sales Rep:</span> <span className="text-slate-900">{reviewing.salesName}</span></p>
                  {reviewing.notes && <p><span className="font-bold text-slate-600">Notes:</span> <span className="text-slate-900">{reviewing.notes}</span></p>}
                  {reviewing.expectedStartDate && <p><span className="font-bold text-slate-600">Expected Start:</span> <span className="text-slate-900">{formatDate(reviewing.expectedStartDate)}</span></p>}
                </div>
                <label className="block">
                  <span className="text-sm font-bold text-slate-700">Decision</span>
                  <select value={reviewStatus} onChange={(e) => setReviewStatus(e.target.value)}
                    className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-[#2E7D32] focus:ring-2 focus:ring-[#E8F5E9]">
                    <option value="Approved">Approve — Convert to Enrollment</option>
                    <option value="Rejected">Reject</option>
                    <option value="More Info Needed">Request More Info</option>
                  </select>
                </label>
                <label className="block">
                  <span className="text-sm font-bold text-slate-700">Note to Sales Rep</span>
                  <textarea value={reviewNote} onChange={(e) => setReviewNote(e.target.value)} rows={3}
                    placeholder="Reason, next steps, or instructions..."
                    className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-[#2E7D32] focus:ring-2 focus:ring-[#E8F5E9]" />
                </label>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setReviewing(null)}
                    className="flex-1 h-10 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-700 hover:bg-slate-50">Cancel</button>
                  <button type="submit" disabled={saving}
                    className="flex-1 inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#2E7D32] text-sm font-bold text-white hover:bg-[#1B5E20] disabled:opacity-60">
                    {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                    Submit Review
                  </button>
                </div>
              </form>
            </div>
          </div>
        </>
      )}

      {loading ? (
        <div className="flex min-h-[260px] items-center justify-center gap-3 text-slate-500">
          <Loader2 className="h-6 w-6 animate-spin text-[#2E7D32]" />
          <span className="text-sm font-semibold">Loading...</span>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Pending */}
          {pending.length > 0 && (
            <section className="overflow-hidden rounded-xl border border-amber-200 bg-white shadow-sm">
              <div className="border-b border-amber-100 bg-amber-50 px-6 py-3">
                <h2 className="text-sm font-bold text-amber-800">Pending ({pending.length})</h2>
              </div>
              <div className="divide-y divide-slate-100">
                {pending.map((r) => <RequestRow key={r.id} r={r} isSales={isSales} onReview={() => { setReviewing(r); setReviewStatus("Approved"); setReviewNote(""); }} />)}
              </div>
            </section>
          )}

          {/* Reviewed */}
          {others.length > 0 && (
            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 bg-slate-50 px-6 py-3">
                <h2 className="text-sm font-bold text-slate-700">Reviewed ({others.length})</h2>
              </div>
              <div className="divide-y divide-slate-100">
                {others.map((r) => <RequestRow key={r.id} r={r} isSales={isSales} onReview={() => { setReviewing(r); setReviewStatus("Approved"); setReviewNote(""); }} />)}
              </div>
            </section>
          )}

          {requests.length === 0 && (
            <div className="flex min-h-[200px] flex-col items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white text-center">
              <CheckCircle2 className="h-8 w-8 text-slate-300" />
              <p className="text-sm font-semibold text-slate-600">No enrollment requests yet.</p>
              {isSales && <p className="text-xs text-slate-400">Use the "Request Enrollment" button on a lead to submit a request.</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function RequestRow({ r, isSales, onReview }: { r: EnrollmentRequest; isSales: boolean; onReview: () => void }) {
  const waUrl = r.leadPhone ? `https://wa.me/${r.leadPhone.replace(/\D/g, "")}` : null;
  return (
    <div className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-bold text-slate-900">{r.leadName}</p>
          {r.leadRef && <span className="font-mono text-xs text-slate-400">{r.leadRef}</span>}
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${statusCls[r.status] ?? "bg-slate-100 text-slate-600"}`}>{r.status}</span>
        </div>
        <p className="text-sm text-slate-600">{r.course}</p>
        <div className="flex flex-wrap gap-3 text-xs text-slate-500">
          {!isSales && <span>Sales: <strong className="text-slate-700">{r.salesName}</strong></span>}
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {new Date(r.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
          </span>
          {waUrl && (
            <a href={waUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[#2E7D32] hover:underline">
              <MessageCircle className="h-3 w-3" />{r.leadPhone}
            </a>
          )}
        </div>
        {r.notes && <p className="text-xs text-slate-400 italic">"{r.notes.slice(0, 120)}{r.notes.length > 120 ? "…" : ""}"</p>}
        {r.reviewNote && (
          <p className="text-xs text-slate-500">
            <span className="font-bold text-slate-600">Admin note:</span> {r.reviewNote}
            {r.reviewedBy && <span className="ml-1 text-slate-400">— {r.reviewedBy}</span>}
          </p>
        )}
      </div>
      {!isSales && r.status === "Pending" && (
        <button onClick={onReview} type="button"
          className="inline-flex h-9 items-center gap-2 rounded-xl border border-[#2E7D32] bg-[#E8F5E9] px-4 text-sm font-bold text-[#2E7D32] transition hover:bg-green-100 shrink-0">
          Review
        </button>
      )}
    </div>
  );
}
