"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";

const cls = "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white";

export default function NewEnrollmentPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const leadId = searchParams.get("leadId") || "";

  const [students, setStudents] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [lead, setLead] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    studentId: "", teacherId: "", courseId: "", subjectId: "",
    packageName: "", sessionsCount: "10", sessionDuration: "60",
    totalPrice: "", discount: "0", finalPrice: "",
    teacherCost: "", paymentPlan: "full",
    startDate: "", endDate: "", notes: "", leadId,
  });

  useEffect(() => {
    Promise.all([
      fetch("/api/students").then((r) => r.json()),
      fetch("/api/teachers").then((r) => r.json()),
      fetch("/api/courses?active=true&withSubjects=true").then((r) => r.json()),
    ]).then(([sd, td, cd]) => {
      setStudents(sd.students || []);
      setTeachers(td.teachers || []);
      setCourses(cd.courses || []);
    });

    if (leadId) {
      fetch(`/api/leads/${leadId}`).then((r) => r.json()).then((d) => {
        setLead(d.lead);
        setForm((f) => ({
          ...f,
          courseId: d.lead.courseId?._id || d.lead.courseId || "",
          subjectId: d.lead.subjectId?._id || d.lead.subjectId || "",
        }));
      });
    }
  }, [leadId]);

  useEffect(() => {
    const course = courses.find((c: any) => c._id === form.courseId);
    setSubjects(course?.subjects || []);
    if (!form.subjectId) setForm((f) => ({ ...f, subjectId: "" }));
  }, [form.courseId, courses]);

  // Auto-calc final price
  useEffect(() => {
    const total = parseFloat(form.totalPrice) || 0;
    const disc = parseFloat(form.discount) || 0;
    setForm((f) => ({ ...f, finalPrice: String(Math.max(0, total - disc)) }));
  }, [form.totalPrice, form.discount]);

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/enrollments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          sessionsCount: parseInt(form.sessionsCount),
          sessionDuration: parseInt(form.sessionDuration),
          totalPrice: parseFloat(form.totalPrice) || 0,
          discount: parseFloat(form.discount) || 0,
          finalPrice: parseFloat(form.finalPrice) || 0,
          teacherCost: parseFloat(form.teacherCost) || 0,
          leadId: form.leadId || undefined,
          subjectId: form.subjectId || undefined,
          startDate: form.startDate || undefined,
          endDate: form.endDate || undefined,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      router.push("/enrollments");
    } catch {
      alert("Failed to create enrollment.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col min-h-screen">
      <PageHeader
        title="New Enrollment"
        subtitle="Register a student in a course"
        actions={
          <Link href="/enrollments" className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-800">
            <ArrowLeft className="w-4 h-4" /> Back
          </Link>
        }
      />

      <div className="p-6 max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-5">
          {lead && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
              Converting lead: <strong>{lead.studentName}</strong> · {lead.courseId?.name || "No course"}
            </div>
          )}

          {/* Student & Teacher */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
            <h3 className="font-semibold text-slate-800">Participants</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <F label="Student *">
                <select required value={form.studentId} onChange={(e) => set("studentId", e.target.value)} className={cls}>
                  <option value="">Select student...</option>
                  {students.map((s) => <option key={s._id} value={s._id}>{s.fullName} · {s.phone}</option>)}
                </select>
              </F>
              <F label="Teacher *">
                <select required value={form.teacherId} onChange={(e) => set("teacherId", e.target.value)} className={cls}>
                  <option value="">Select teacher...</option>
                  {teachers.map((t) => <option key={t._id} value={t._id}>{t.fullName}</option>)}
                </select>
              </F>
              <F label="Course *">
                <select required value={form.courseId} onChange={(e) => set("courseId", e.target.value)} className={cls}>
                  <option value="">Select course...</option>
                  {courses.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
                </select>
              </F>
              <F label="Subject">
                <select value={form.subjectId} onChange={(e) => set("subjectId", e.target.value)} disabled={!subjects.length} className={cls}>
                  <option value="">Select subject...</option>
                  {subjects.map((s: any) => <option key={s._id} value={s._id}>{s.name}</option>)}
                </select>
              </F>
            </div>
          </div>

          {/* Package */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
            <h3 className="font-semibold text-slate-800">Package Details</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <F label="Package Name">
                <input value={form.packageName} onChange={(e) => set("packageName", e.target.value)} placeholder="e.g. 20-session SAT" className={cls} />
              </F>
              <F label="Sessions *">
                <input required type="number" min="1" value={form.sessionsCount} onChange={(e) => set("sessionsCount", e.target.value)} className={cls} />
              </F>
              <F label="Duration (min)">
                <input type="number" min="30" step="15" value={form.sessionDuration} onChange={(e) => set("sessionDuration", e.target.value)} className={cls} />
              </F>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <F label="Start Date"><input type="date" value={form.startDate} onChange={(e) => set("startDate", e.target.value)} className={cls} /></F>
              <F label="End Date"><input type="date" value={form.endDate} onChange={(e) => set("endDate", e.target.value)} className={cls} /></F>
            </div>
          </div>

          {/* Pricing */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
            <h3 className="font-semibold text-slate-800">Pricing</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <F label="Total Price (AED) *">
                <input required type="number" min="0" value={form.totalPrice} onChange={(e) => set("totalPrice", e.target.value)} placeholder="0" className={cls} />
              </F>
              <F label="Discount (AED)">
                <input type="number" min="0" value={form.discount} onChange={(e) => set("discount", e.target.value)} placeholder="0" className={cls} />
              </F>
              <F label="Final Price (AED)">
                <input readOnly value={form.finalPrice} className={`${cls} bg-slate-50 font-semibold text-green-700`} />
              </F>
              <F label="Teacher Cost (AED)">
                <input type="number" min="0" value={form.teacherCost} onChange={(e) => set("teacherCost", e.target.value)} placeholder="0" className={cls} />
              </F>
            </div>
            <F label="Payment Plan">
              <select value={form.paymentPlan} onChange={(e) => set("paymentPlan", e.target.value)} className={cls}>
                <option value="full">Full Payment</option>
                <option value="installments">Installments</option>
                <option value="monthly">Monthly</option>
              </select>
            </F>
          </div>

          <F label="Notes">
            <textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={3} placeholder="Any notes..." className={cls} />
          </F>

          <div className="flex gap-3">
            <button type="submit" disabled={loading} className="px-6 py-2.5 bg-blue-600 text-white font-medium text-sm rounded-lg hover:bg-blue-700 transition disabled:opacity-50 flex items-center gap-2">
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? "Creating..." : "Create Enrollment"}
            </button>
            <Link href="/enrollments" className="px-6 py-2.5 border border-slate-200 text-slate-600 text-sm rounded-lg hover:bg-slate-50 transition">Cancel</Link>
          </div>
        </form>
      </div>
    </div>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>{children}</div>;
}
