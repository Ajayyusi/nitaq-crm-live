"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, UserCheck, Phone, Mail, Star, CheckCircle, Loader2 } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import StatusBadge from "@/components/shared/StatusBadge";

export default function NewAllocationPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const leadId = searchParams.get("leadId") || "";

  const [lead, setLead] = useState<any>(null);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [selectedTeacher, setSelectedTeacher] = useState<string>("");
  const [backupTeacher, setBackupTeacher] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [leads, setLeads] = useState<any[]>([]);
  const [selectedLeadId, setSelectedLeadId] = useState(leadId);

  const fetchLead = useCallback(async (id: string) => {
    if (!id) return;
    const res = await fetch(`/api/leads/${id}`);
    const d = await res.json();
    setLead(d.lead);

    // Fetch matching teachers for the lead's subject
    if (d.lead?.subjectId?._id || d.lead?.subjectId) {
      const subjectId = d.lead.subjectId?._id || d.lead.subjectId;
      const mode = d.lead.mode;
      const params = new URLSearchParams({ subjectId });
      if (mode && mode !== "hybrid") params.set("mode", mode);
      const teachersRes = await fetch(`/api/teachers?${params}`);
      const td = await teachersRes.json();
      setTeachers(td.teachers || []);
    } else {
      // No subject filter — show all active teachers
      const teachersRes = await fetch("/api/teachers");
      const td = await teachersRes.json();
      setTeachers(td.teachers || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    // Also fetch all leads for the lead picker
    fetch("/api/leads?status=new&limit=50")
      .then((r) => r.json())
      .then((d) => setLeads(d.leads || []));
  }, []);

  useEffect(() => {
    if (selectedLeadId) {
      setLoading(true);
      fetchLead(selectedLeadId);
    } else {
      setLoading(false);
    }
  }, [selectedLeadId, fetchLead]);

  async function handleAllocate() {
    if (!selectedLeadId || !selectedTeacher) return;
    setSaving(true);
    try {
      const res = await fetch("/api/allocations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: selectedLeadId,
          teacherId: selectedTeacher,
          backupTeacherId: backupTeacher || undefined,
          courseId: lead?.courseId?._id || lead?.courseId,
          subjectId: lead?.subjectId?._id || lead?.subjectId,
          notes,
          status: "confirmed",
        }),
      });
      if (!res.ok) throw new Error("Failed");
      router.push("/allocations");
    } catch {
      alert("Failed to create allocation.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col min-h-screen">
      <PageHeader
        title="Allocate Teacher"
        subtitle="Manually assign a teacher to a lead"
        actions={
          <Link href="/allocations" className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-800">
            <ArrowLeft className="w-4 h-4" /> Back
          </Link>
        }
      />

      <div className="p-6 max-w-4xl space-y-5">
        {/* Step 1: Lead */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold">1</span>
            Select Lead
          </h3>
          {!leadId ? (
            <select
              value={selectedLeadId}
              onChange={(e) => setSelectedLeadId(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">-- Select a lead --</option>
              {leads.map((l) => (
                <option key={l._id} value={l._id}>
                  {l.studentName} · {l.studentPhone} · {l.courseId?.name || "No course"}
                </option>
              ))}
            </select>
          ) : lead ? (
            <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-lg">
              <div className="flex-1">
                <p className="font-medium text-slate-800">{lead.studentName}</p>
                <div className="flex items-center gap-4 text-sm text-slate-500 mt-1">
                  <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" />{lead.studentPhone}</span>
                  {lead.courseId && <span>{lead.courseId.name}</span>}
                  {lead.subjectId && <span>· {lead.subjectId.name}</span>}
                  {lead.mode && <span className="capitalize">· {lead.mode}</span>}
                </div>
              </div>
              <StatusBadge status={lead.status} />
            </div>
          ) : null}
        </div>

        {/* Step 2: Teacher selection */}
        {selectedLeadId && (
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="font-semibold text-slate-800 mb-1 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold">2</span>
              Select Teacher
            </h3>
            <p className="text-xs text-slate-400 mb-4 ml-8">
              {lead?.subjectId
                ? `Showing teachers who can teach ${lead.subjectId.name}`
                : "Showing all active teachers"}
            </p>

            {loading ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-slate-100 rounded-lg animate-pulse" />)}
              </div>
            ) : teachers.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-sm">
                No matching teachers found. Ensure teachers have the subject mapped.
              </div>
            ) : (
              <div className="space-y-2">
                {teachers.map((teacher) => {
                  const isSelected = selectedTeacher === teacher._id;
                  const isBackup = backupTeacher === teacher._id;
                  return (
                    <div
                      key={teacher._id}
                      className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                        isSelected
                          ? "border-blue-500 bg-blue-50"
                          : isBackup
                          ? "border-amber-400 bg-amber-50"
                          : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                        {teacher.fullName.split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-slate-800">{teacher.fullName}</p>
                          {isSelected && <span className="text-xs bg-blue-600 text-white px-1.5 py-0.5 rounded">Primary</span>}
                          {isBackup && <span className="text-xs bg-amber-500 text-white px-1.5 py-0.5 rounded">Backup</span>}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
                          {teacher.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{teacher.phone}</span>}
                          <span className="capitalize">{teacher.employmentType?.replace("_", " ")}</span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setSelectedTeacher(isSelected ? "" : teacher._id);
                            if (backupTeacher === teacher._id) setBackupTeacher("");
                          }}
                          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition ${
                            isSelected
                              ? "bg-blue-600 text-white"
                              : "border border-slate-200 text-slate-600 hover:bg-blue-50 hover:border-blue-300"
                          }`}
                        >
                          {isSelected ? "✓ Primary" : "Set Primary"}
                        </button>
                        <button
                          onClick={() => {
                            setBackupTeacher(isBackup ? "" : teacher._id);
                            if (selectedTeacher === teacher._id) setSelectedTeacher("");
                          }}
                          disabled={isSelected}
                          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition disabled:opacity-30 ${
                            isBackup
                              ? "bg-amber-500 text-white"
                              : "border border-slate-200 text-slate-600 hover:bg-amber-50 hover:border-amber-300"
                          }`}
                        >
                          {isBackup ? "✓ Backup" : "Set Backup"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Step 3: Notes and confirm */}
        {selectedTeacher && (
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold">3</span>
              Notes & Confirm
            </h3>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Any notes about this allocation..."
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
            />
            <div className="flex gap-3">
              <button
                onClick={handleAllocate}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white font-medium text-sm rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                {saving ? "Allocating..." : "Confirm Allocation"}
              </button>
              <Link href="/allocations" className="px-6 py-2.5 border border-slate-200 text-slate-600 text-sm rounded-lg hover:bg-slate-50 transition">
                Cancel
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
