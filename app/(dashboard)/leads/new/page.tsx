"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/shared/PageHeader";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";

const SOURCES = ["walk_in", "referral", "instagram", "facebook", "google", "website", "whatsapp", "other"];
const MODES = ["online", "offline", "hybrid"];

export default function NewLeadPage() {
  const router = useRouter();
  const [courses, setCourses] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    studentName: "", studentPhone: "", parentPhone: "", email: "",
    courseId: "", subjectId: "", mode: "offline", preferredTime: "",
    leadSource: "walk_in", notes: "", followUpDate: "",
  });

  useEffect(() => {
    fetch("/api/courses?active=true")
      .then((r) => r.json())
      .then((d) => setCourses(d.courses || []));
  }, []);

  useEffect(() => {
    if (form.courseId) {
      fetch(`/api/subjects?courseId=${form.courseId}`)
        .then((r) => r.json())
        .then((d) => setSubjects(d.subjects || []));
    } else {
      setSubjects([]);
      setForm((f) => ({ ...f, subjectId: "" }));
    }
  }, [form.courseId]);

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          courseId: form.courseId || undefined,
          subjectId: form.subjectId || undefined,
          followUpDate: form.followUpDate || undefined,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      const { lead } = await res.json();
      router.push(`/leads/${lead._id}`);
    } catch {
      alert("Failed to create lead. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col min-h-screen">
      <PageHeader
        title="New Lead"
        subtitle="Add a new prospect to the CRM"
        actions={
          <Link href="/leads" className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-800">
            <ArrowLeft className="w-4 h-4" /> Back to Leads
          </Link>
        }
      />

      <div className="p-6 max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Student Info */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
            <h3 className="font-semibold text-slate-800">Student Information</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Student Name *">
                <input required value={form.studentName} onChange={(e) => set("studentName", e.target.value)} placeholder="Full name" className={inputCls} />
              </FormField>
              <FormField label="Student Phone *">
                <input required value={form.studentPhone} onChange={(e) => set("studentPhone", e.target.value)} placeholder="+971 50 000 0000" className={inputCls} />
              </FormField>
              <FormField label="Parent Phone">
                <input value={form.parentPhone} onChange={(e) => set("parentPhone", e.target.value)} placeholder="+971 50 000 0000" className={inputCls} />
              </FormField>
              <FormField label="Email">
                <input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="student@email.com" className={inputCls} />
              </FormField>
            </div>
          </div>

          {/* Course Interest */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
            <h3 className="font-semibold text-slate-800">Course Interest</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Course">
                <select value={form.courseId} onChange={(e) => set("courseId", e.target.value)} className={inputCls}>
                  <option value="">Select course...</option>
                  {courses.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
                </select>
              </FormField>
              <FormField label="Subject">
                <select value={form.subjectId} onChange={(e) => set("subjectId", e.target.value)} disabled={!subjects.length} className={inputCls}>
                  <option value="">Select subject...</option>
                  {subjects.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
                </select>
              </FormField>
              <FormField label="Mode">
                <select value={form.mode} onChange={(e) => set("mode", e.target.value)} className={inputCls}>
                  {MODES.map((m) => <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>)}
                </select>
              </FormField>
              <FormField label="Preferred Time">
                <input value={form.preferredTime} onChange={(e) => set("preferredTime", e.target.value)} placeholder="e.g. Weekday evenings" className={inputCls} />
              </FormField>
            </div>
          </div>

          {/* Lead Details */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
            <h3 className="font-semibold text-slate-800">Lead Details</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Lead Source *">
                <select required value={form.leadSource} onChange={(e) => set("leadSource", e.target.value)} className={inputCls}>
                  {SOURCES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
                </select>
              </FormField>
              <FormField label="Follow-up Date">
                <input type="date" value={form.followUpDate} onChange={(e) => set("followUpDate", e.target.value)} className={inputCls} />
              </FormField>
            </div>
            <FormField label="Notes">
              <textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={3} placeholder="Any additional notes..." className={inputCls} />
            </FormField>
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 bg-blue-600 text-white font-medium text-sm rounded-lg hover:bg-blue-700 transition disabled:opacity-50 flex items-center gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? "Creating..." : "Create Lead"}
            </button>
            <Link href="/leads" className="px-6 py-2.5 border border-slate-200 text-slate-600 font-medium text-sm rounded-lg hover:bg-slate-50 transition">
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}

const inputCls = "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition bg-white";

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>
      {children}
    </div>
  );
}
