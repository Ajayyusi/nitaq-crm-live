"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Phone, Mail, Calendar, Edit2, Save, X, UserPlus, ClipboardList } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import StatusBadge from "@/components/shared/StatusBadge";
import { formatDate } from "@/lib/utils";

const STATUSES = ["new", "contacted", "trial_booked", "trial_done", "enrolled", "lost", "on_hold"];

export default function LeadDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [lead, setLead] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/leads/${id}`)
      .then((r) => r.json())
      .then((d) => {
        setLead(d.lead);
        setEditForm({
          status: d.lead.status,
          notes: d.lead.notes || "",
          followUpDate: d.lead.followUpDate
            ? new Date(d.lead.followUpDate).toISOString().split("T")[0]
            : "",
        });
        setLoading(false);
      });
  }, [id]);

  async function saveChanges() {
    setSaving(true);
    const res = await fetch(`/api/leads/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editForm),
    });
    if (res.ok) {
      const d = await res.json();
      setLead(d.lead);
      setEditing(false);
    }
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-8 w-48 bg-slate-100 rounded animate-pulse" />
        <div className="h-48 bg-slate-100 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (!lead) return <div className="p-6 text-slate-500">Lead not found.</div>;

  return (
    <div className="flex flex-col min-h-screen">
      <PageHeader
        title={lead.studentName}
        subtitle="Lead Profile"
        actions={
          <div className="flex gap-2">
            <Link href="/leads" className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-800">
              <ArrowLeft className="w-4 h-4" /> Back
            </Link>
            {!editing ? (
              <button onClick={() => setEditing(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 transition">
                <Edit2 className="w-3.5 h-3.5" /> Edit
              </button>
            ) : (
              <div className="flex gap-2">
                <button onClick={saveChanges} disabled={saving} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50">
                  <Save className="w-3.5 h-3.5" /> {saving ? "Saving..." : "Save"}
                </button>
                <button onClick={() => setEditing(false)} className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 transition">
                  <X className="w-3.5 h-3.5" /> Cancel
                </button>
              </div>
            )}
          </div>
        }
      />

      <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main info */}
        <div className="lg:col-span-2 space-y-4">
          {/* Contact card */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-semibold text-slate-800 text-lg">{lead.studentName}</h3>
                <div className="flex items-center gap-4 mt-2 text-sm text-slate-500">
                  <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" /> {lead.studentPhone}</span>
                  {lead.email && <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5" /> {lead.email}</span>}
                </div>
              </div>
              <StatusBadge status={lead.status} />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-100">
              <InfoItem label="Course" value={lead.courseId?.name || "—"} />
              <InfoItem label="Subject" value={lead.subjectId?.name || "—"} />
              <InfoItem label="Mode" value={lead.mode || "—"} />
              <InfoItem label="Source" value={lead.leadSource?.replace("_", " ") || "—"} />
              <InfoItem label="Parent Phone" value={lead.parentPhone || "—"} />
              <InfoItem label="Preferred Time" value={lead.preferredTime || "—"} />
            </div>
          </div>

          {/* Notes / Status edit */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="font-semibold text-slate-800 mb-4">Status & Notes</h3>
            {editing ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Status</label>
                  <select
                    value={editForm.status}
                    onChange={(e) => setEditForm((f: any) => ({ ...f, status: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {STATUSES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Follow-up Date</label>
                  <input
                    type="date"
                    value={editForm.followUpDate}
                    onChange={(e) => setEditForm((f: any) => ({ ...f, followUpDate: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Notes</label>
                  <textarea
                    value={editForm.notes}
                    onChange={(e) => setEditForm((f: any) => ({ ...f, notes: e.target.value }))}
                    rows={4}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-500">Status:</span>
                  <StatusBadge status={lead.status} />
                </div>
                {lead.followUpDate && (
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <Calendar className="w-3.5 h-3.5" />
                    Follow-up: {formatDate(lead.followUpDate)}
                  </div>
                )}
                <p className="text-sm text-slate-600 whitespace-pre-line">{lead.notes || "No notes added."}</p>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar actions */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="font-semibold text-slate-800 mb-3">Actions</h3>
            <div className="space-y-2">
              <Link
                href={`/allocations/new?leadId=${lead._id}`}
                className="flex items-center gap-2 w-full px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition"
              >
                <UserPlus className="w-4 h-4" />
                Allocate Teacher
              </Link>
              <Link
                href={`/enrollments/new?leadId=${lead._id}`}
                className="flex items-center gap-2 w-full px-4 py-2.5 border border-slate-200 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition"
              >
                <ClipboardList className="w-4 h-4" />
                Convert to Enrollment
              </Link>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="font-semibold text-slate-800 mb-3">Timeline</h3>
            <div className="space-y-2 text-xs text-slate-500">
              <p>Created: {formatDate(lead.createdAt)}</p>
              {lead.updatedAt !== lead.createdAt && <p>Updated: {formatDate(lead.updatedAt)}</p>}
              {lead.assignedSalesUser && (
                <p>Assigned to: {lead.assignedSalesUser.name}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-slate-400 uppercase tracking-wide mb-0.5">{label}</p>
      <p className="text-sm text-slate-700 font-medium capitalize">{value}</p>
    </div>
  );
}
