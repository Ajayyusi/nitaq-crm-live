"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";

const cls = "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white";

export default function NewTeacherPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    fullName: "", phone: "", whatsapp: "", email: "",
    jobTitle: "", employmentType: "part_time", status: "active",
    branchPreference: "", notes: "",
  });

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/teachers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error("Failed");
      const { teacher } = await res.json();
      router.push(`/teachers/${teacher._id}`);
    } catch {
      alert("Failed to create teacher.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col min-h-screen">
      <PageHeader
        title="Add Teacher"
        subtitle="Register a new teacher in the system"
        actions={
          <Link href="/teachers" className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-800">
            <ArrowLeft className="w-4 h-4" /> Back to Teachers
          </Link>
        }
      />

      <div className="p-6 max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
            <h3 className="font-semibold text-slate-800">Personal Information</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <F label="Full Name *"><input required value={form.fullName} onChange={(e) => set("fullName", e.target.value)} placeholder="Teacher's full name" className={cls} /></F>
              <F label="Phone *"><input required value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+971 50 000 0000" className={cls} /></F>
              <F label="WhatsApp"><input value={form.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} placeholder="+971 50 000 0000" className={cls} /></F>
              <F label="Email"><input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="teacher@email.com" className={cls} /></F>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
            <h3 className="font-semibold text-slate-800">Employment Details</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <F label="Job Title"><input value={form.jobTitle} onChange={(e) => set("jobTitle", e.target.value)} placeholder="e.g. SAT Math Tutor" className={cls} /></F>
              <F label="Employment Type">
                <select value={form.employmentType} onChange={(e) => set("employmentType", e.target.value)} className={cls}>
                  <option value="full_time">Full-time</option>
                  <option value="part_time">Part-time</option>
                  <option value="freelance">Freelance</option>
                  <option value="contract">Contract</option>
                </select>
              </F>
              <F label="Status">
                <select value={form.status} onChange={(e) => set("status", e.target.value)} className={cls}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="on_leave">On Leave</option>
                </select>
              </F>
              <F label="Branch Preference"><input value={form.branchPreference} onChange={(e) => set("branchPreference", e.target.value)} placeholder="e.g. Main branch" className={cls} /></F>
            </div>
            <F label="Notes">
              <textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={3} placeholder="Any internal notes..." className={cls} />
            </F>
          </div>

          <div className="flex gap-3">
            <button type="submit" disabled={loading} className="px-6 py-2.5 bg-blue-600 text-white font-medium text-sm rounded-lg hover:bg-blue-700 transition disabled:opacity-50 flex items-center gap-2">
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? "Creating..." : "Create Teacher"}
            </button>
            <Link href="/teachers" className="px-6 py-2.5 border border-slate-200 text-slate-600 text-sm rounded-lg hover:bg-slate-50 transition">Cancel</Link>
          </div>
        </form>
      </div>
    </div>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>{children}</div>;
}
