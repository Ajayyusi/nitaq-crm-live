"use client";

import { useState, useRef } from "react";
import { Upload, Download, FileText, AlertCircle, CheckCircle, X, Loader2 } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import Papa from "papaparse";
import { IMPORT_EXPORT_PERMISSIONS, hasRole } from "@/lib/permissions";
import type { AppRole } from "@/lib/permissions";

const TEMPLATES: Record<string, { fields: string[]; example: Record<string, string> }> = {
  leads: {
    fields: ["fullName", "phone", "email", "course", "source", "stage", "nextFollowUpDate", "assignedTo", "notes"],
    example: {
      fullName: "Mohammed Ali", phone: "+971501234567", email: "mohammed@email.com",
      course: "Digital Marketing Mastery", source: "Instagram", stage: "Lead",
      nextFollowUpDate: "2026-06-15", assignedTo: "", notes: "",
    },
  },
  followups: {
    fields: ["contactName", "phone", "course", "followUpDate", "type", "status", "assignedTo", "notes"],
    example: {
      contactName: "Sara Ahmed", phone: "+971501234567", course: "Excel & Power BI",
      followUpDate: "2026-06-15", type: "WhatsApp Message", status: "Pending",
      assignedTo: "", notes: "",
    },
  },
  students: {
    fields: ["fullName", "phone", "email", "emiratesId", "nationality", "course", "batchName", "startDate", "endDate", "schedule", "format", "status", "paymentStatus", "totalFee", "amountPaid", "notes"],
    example: {
      fullName: "Sara Ahmed", phone: "+971501234567", email: "sara@email.com",
      emiratesId: "784-1990-1234567-1", nationality: "UAE",
      course: "Digital Marketing Mastery", batchName: "Batch A",
      startDate: "2026-07-01", endDate: "2026-09-01", schedule: "Mon/Wed 6-8pm",
      format: "In-Person", status: "Active", paymentStatus: "Paid Full",
      totalFee: "2500", amountPaid: "2500", notes: "",
    },
  },
  enrollments: {
    fields: ["fullName", "phone", "email", "emiratesId", "nationality", "course", "batchName", "startDate", "endDate", "schedule", "format", "status", "paymentStatus", "totalFee", "amountPaid", "notes"],
    example: {
      fullName: "Ahmed Hassan", phone: "+971501234568", email: "ahmed@email.com",
      emiratesId: "", nationality: "Egypt",
      course: "Excel & Power BI", batchName: "Batch B",
      startDate: "2026-07-01", endDate: "2026-08-01", schedule: "Tue/Thu 7-9pm",
      format: "Online", status: "Active", paymentStatus: "Instalment 1 Paid",
      totalFee: "1800", amountPaid: "900", notes: "",
    },
  },
  courses: {
    fields: ["courseCode", "courseName", "category", "description", "durationWeeks", "totalSessions", "sessionsPerWeek", "hoursPerSession", "priceExVat", "vatRate", "maxStudentsPerBatch", "status"],
    example: {
      courseCode: "DIG101", courseName: "Digital Marketing Mastery",
      category: "Business & Admin Training", description: "Comprehensive digital marketing course",
      durationWeeks: "8", totalSessions: "16", sessionsPerWeek: "2", hoursPerSession: "2",
      priceExVat: "2500", vatRate: "5", maxStudentsPerBatch: "20", status: "Active",
    },
  },
  teachers: {
    fields: ["fullName", "phone", "email", "emiratesId", "nationality", "specialisation", "qualifications", "tamamStatus", "tamamNumber", "contractStatus", "contractStartDate", "contractEndDate", "paymentRate", "paymentType", "status", "notes"],
    example: {
      fullName: "Dr. Khalid Al-Rashidi", phone: "+971501234567", email: "khalid@email.com",
      emiratesId: "784-1985-1234567-1", nationality: "UAE",
      specialisation: "Digital Marketing", qualifications: "MBA, Google Certified",
      tamamStatus: "Registered", tamamNumber: "TAM-12345",
      contractStatus: "Active", contractStartDate: "2026-01-01", contractEndDate: "2026-12-31",
      paymentRate: "150", paymentType: "Per Session", status: "Active", notes: "",
    },
  },
  payments: {
    fields: ["studentName", "studentPhone", "course", "amount", "paymentType", "paymentMethod", "status", "datePaid", "dueDate", "receiptRef", "notes"],
    example: {
      studentName: "Sara Ahmed", studentPhone: "+971501234567",
      course: "Digital Marketing Mastery", amount: "2500",
      paymentType: "Full Payment", paymentMethod: "Bank Transfer",
      status: "Received", datePaid: "2026-06-10", dueDate: "", receiptRef: "REC-001", notes: "",
    },
  },
  expenses: {
    fields: ["category", "amount", "expenseDate", "payee", "description", "notes"],
    example: {
      category: "Rent", amount: "8000", expenseDate: "2026-06-01",
      payee: "Al Nahda Properties LLC", description: "Monthly office rent", notes: "",
    },
  },
  classes: {
    fields: ["course", "batchName", "sessionDate", "sessionNumber", "topic", "trainerName"],
    example: {
      course: "Digital Marketing Mastery", batchName: "Batch A",
      sessionDate: "2026-06-15", sessionNumber: "1",
      topic: "Introduction to Digital Marketing", trainerName: "Dr. Khalid",
    },
  },
};

const ALL_ENTITIES = [
  { key: "leads", label: "Leads", icon: "📊" },
  { key: "followups", label: "Follow-ups", icon: "📅" },
  { key: "students", label: "Students", icon: "🎓" },
  { key: "enrollments", label: "Enrollments", icon: "📋" },
  { key: "courses", label: "Courses", icon: "📚" },
  { key: "teachers", label: "Teachers", icon: "👨‍🏫" },
  { key: "payments", label: "Payments", icon: "💰" },
  { key: "expenses", label: "Expenses", icon: "📉" },
  { key: "classes", label: "Classes", icon: "🏫" },
];

interface ImportResult {
  total: number;
  success: number;
  failed: number;
  errors: { row: number; error: string }[];
}

export default function ImportExportClient({ role }: { role: AppRole }) {
  const importEntities = ALL_ENTITIES.filter((e) => {
    const p = IMPORT_EXPORT_PERMISSIONS[e.key === "students" ? "enrollments" : e.key];
    return p && hasRole(role, p.import);
  });
  const exportEntities = ALL_ENTITIES.filter((e) => {
    const p = IMPORT_EXPORT_PERMISSIONS[e.key === "students" ? "enrollments" : e.key];
    return p && hasRole(role, p.export);
  });

  const [activeTab, setActiveTab] = useState<"import" | "export">("import");
  const [importEntity, setImportEntity] = useState(importEntities[0]?.key ?? "leads");
  const [exportEntity, setExportEntity] = useState(exportEntities[0]?.key ?? "leads");
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<Record<string, string>[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function downloadTemplate(entity: string) {
    const template = TEMPLATES[entity];
    if (!template) return;
    const csv = Papa.unparse([template.example], { columns: template.fields });
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `nitaq_${entity}_template.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFile(file);
    setImportResult(null);
    setParseErrors([]);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const errors: string[] = [];
        const template = TEMPLATES[importEntity];
        if (template) {
          const required = template.fields.slice(0, 2);
          results.data.forEach((row: unknown, i: number) => {
            const r = row as Record<string, string>;
            required.forEach((field) => {
              if (!r[field]?.trim()) errors.push(`Row ${i + 2}: missing "${field}"`);
            });
          });
        }
        setParsedRows(results.data as Record<string, string>[]);
        setParseErrors(errors);
      },
      error: () => setParseErrors(["Could not parse the CSV file. Please check the format."]),
    });
  }

  async function handleImport() {
    if (!parsedRows.length || parseErrors.length) return;
    setImporting(true);
    setImportResult(null);

    try {
      const res = await fetch(`/api/import/${importEntity}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: parsedRows }),
      });
      const data = await res.json();
      setImportResult(data);
    } catch {
      setImportResult({ total: parsedRows.length, success: 0, failed: parsedRows.length, errors: [{ row: 0, error: "Network error during import" }] });
    } finally {
      setImporting(false);
    }
  }

  async function handleExport() {
    setExporting(true);
    try {
      const res = await fetch(`/api/export/${exportEntity}`);
      const data = await res.json();
      const rows = data.rows ?? [];
      if (!rows.length) { alert("No data to export for this section."); setExporting(false); return; }
      const csv = Papa.unparse(rows);
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `nitaq_${exportEntity}_${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("Export failed. Please try again.");
    } finally {
      setExporting(false);
    }
  }

  function resetImport() {
    setCsvFile(null);
    setParsedRows([]);
    setParseErrors([]);
    setImportResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const entityLabel = (key: string) => ALL_ENTITIES.find((e) => e.key === key)?.label ?? key;

  return (
    <div className="flex flex-col min-h-screen">
      <PageHeader title="Import / Export" subtitle="Bulk data management via CSV" />

      {/* Tabs */}
      <div className="bg-white border-b border-slate-200 px-4 sm:px-6">
        <div className="flex gap-0">
          {(["import", "export"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-3.5 text-sm font-medium border-b-2 transition capitalize ${
                activeTab === tab
                  ? "border-[#2E7D32] text-[#2E7D32]"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              {tab === "import" ? "⬆️" : "⬇️"} {tab === "import" ? "Import Data" : "Export Data"}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 sm:p-6 max-w-4xl space-y-6">
        {activeTab === "import" && (
          <>
            {/* Step 1: Templates */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-6">
              <h3 className="font-semibold text-slate-800 mb-1">Step 1 — Download Template</h3>
              <p className="text-sm text-slate-500 mb-4">Download the CSV template for the section you want to import, fill in your data, then upload below. Maximum 500 rows per import.</p>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 sm:gap-3">
                {importEntities.map((ent) => (
                  <button
                    key={ent.key}
                    onClick={() => downloadTemplate(ent.key)}
                    className="flex flex-col items-center gap-1.5 p-2.5 sm:p-3 rounded-xl border border-slate-200 hover:border-[#2E7D32] hover:bg-[#E8F5E9]/50 transition group"
                  >
                    <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-slate-400 group-hover:text-[#2E7D32] transition" />
                    <span className="text-xs font-medium text-slate-600 text-center leading-tight">{ent.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Step 2: Upload */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-6">
              <h3 className="font-semibold text-slate-800 mb-4">Step 2 — Upload CSV</h3>
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Import Type</label>
                <select
                  value={importEntity}
                  onChange={(e) => { setImportEntity(e.target.value); resetImport(); }}
                  className="w-full sm:w-64 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E7D32]"
                >
                  {importEntities.map((e) => (
                    <option key={e.key} value={e.key}>{e.icon} {e.label}</option>
                  ))}
                </select>
              </div>

              {["teachers", "followups", "classes"].includes(importEntity) && (
                <div className="mb-4 flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                  <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                  <span><strong>{entityLabel(importEntity)}</strong> has no unique identifier — importing the same file twice will create duplicate records. Make sure you only import each file once.</span>
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                className="hidden"
                id="csvUpload"
              />
              <label
                htmlFor="csvUpload"
                className={`flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-xl p-6 sm:p-8 cursor-pointer transition ${
                  csvFile ? "border-[#2E7D32] bg-[#E8F5E9]/40" : "border-slate-300 hover:border-[#2E7D32] hover:bg-slate-50"
                }`}
              >
                <Upload className={`w-7 h-7 sm:w-8 sm:h-8 ${csvFile ? "text-[#2E7D32]" : "text-slate-400"}`} />
                {csvFile ? (
                  <div className="text-center">
                    <p className="text-sm font-medium text-[#2E7D32]">{csvFile.name}</p>
                    <p className="text-xs text-[#2E7D32]/70">{parsedRows.length} rows parsed</p>
                  </div>
                ) : (
                  <div className="text-center">
                    <p className="text-sm font-medium text-slate-700">Tap to upload CSV file</p>
                    <p className="text-xs text-slate-400">or drag and drop</p>
                  </div>
                )}
              </label>
            </div>

            {/* Step 3: Review & Import */}
            {(parsedRows.length > 0 || parseErrors.length > 0) && !importResult && (
              <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-6">
                <h3 className="font-semibold text-slate-800 mb-4">Step 3 — Review & Import</h3>

                {parseErrors.length > 0 && (
                  <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-center gap-2 text-red-700 font-medium text-sm mb-2">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" /> Validation Errors ({parseErrors.length})
                    </div>
                    <ul className="space-y-1">
                      {parseErrors.slice(0, 10).map((err, i) => (
                        <li key={i} className="text-xs text-red-600">{err}</li>
                      ))}
                      {parseErrors.length > 10 && <li className="text-xs text-red-400">...and {parseErrors.length - 10} more</li>}
                    </ul>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 p-4 bg-slate-50 rounded-lg">
                  <div className="text-sm text-slate-600">
                    <span className="font-semibold text-slate-800">{parsedRows.length}</span> rows ready to import into <span className="font-semibold">{entityLabel(importEntity)}</span>
                    {parseErrors.length > 0 && <span className="text-red-500 ml-2">({parseErrors.length} with errors)</span>}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={resetImport} className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg hover:bg-white transition flex items-center gap-1">
                      <X className="w-3.5 h-3.5" /> Clear
                    </button>
                    <button
                      onClick={handleImport}
                      disabled={importing || parsedRows.length === 0}
                      className="px-4 py-1.5 text-xs bg-[#2E7D32] text-white rounded-lg hover:bg-[#1B5E20] transition disabled:opacity-50 flex items-center gap-1.5"
                    >
                      {importing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                      {importing ? "Importing..." : `Import ${parsedRows.length} Rows`}
                    </button>
                  </div>
                </div>

                {/* Preview table */}
                <div className="overflow-auto rounded-lg border border-slate-200 max-h-56">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        {parsedRows[0] && Object.keys(parsedRows[0]).map((k) => (
                          <th key={k} className="text-left px-3 py-2 font-semibold text-slate-500 whitespace-nowrap">{k}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {parsedRows.slice(0, 5).map((row, i) => (
                        <tr key={i}>
                          {Object.values(row).map((val, j) => (
                            <td key={j} className="px-3 py-2 text-slate-600 whitespace-nowrap max-w-[8rem] truncate">{String(val)}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {parsedRows.length > 5 && (
                    <p className="text-center text-xs text-slate-400 py-2">...and {parsedRows.length - 5} more rows</p>
                  )}
                </div>
              </div>
            )}

            {/* Import Result */}
            {importResult && (
              <div className={`bg-white rounded-xl border p-4 sm:p-6 ${importResult.failed === 0 ? "border-green-200" : "border-amber-200"}`}>
                <div className={`flex items-center gap-2 mb-4 font-semibold ${importResult.failed === 0 ? "text-green-700" : "text-amber-700"}`}>
                  <CheckCircle className="w-5 h-5" />
                  Import Complete
                </div>
                <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-4">
                  <div className="bg-slate-50 rounded-lg p-3 text-center">
                    <p className="text-xl sm:text-2xl font-bold text-slate-800">{importResult.total}</p>
                    <p className="text-xs text-slate-400">Total</p>
                  </div>
                  <div className="bg-green-50 rounded-lg p-3 text-center">
                    <p className="text-xl sm:text-2xl font-bold text-green-700">{importResult.success}</p>
                    <p className="text-xs text-green-500">Imported</p>
                  </div>
                  <div className="bg-red-50 rounded-lg p-3 text-center">
                    <p className="text-xl sm:text-2xl font-bold text-red-600">{importResult.failed}</p>
                    <p className="text-xs text-red-400">Failed</p>
                  </div>
                </div>
                {importResult.errors.length > 0 && (
                  <div className="p-3 bg-red-50 rounded-lg mb-4">
                    <p className="text-xs font-semibold text-red-700 mb-1">Failed rows:</p>
                    {importResult.errors.map((e, i) => (
                      <p key={i} className="text-xs text-red-600">Row {e.row}: {e.error}</p>
                    ))}
                  </div>
                )}
                <button onClick={resetImport} className="px-4 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 transition">
                  Import Another File
                </button>
              </div>
            )}
          </>
        )}

        {activeTab === "export" && (
          <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-6 space-y-6">
            <div>
              <h3 className="font-semibold text-slate-800 mb-1">Export Data as CSV</h3>
              <p className="text-sm text-slate-500">Select a section and download all records as a CSV file.</p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {exportEntities.map((entity) => (
                <button
                  key={entity.key}
                  onClick={() => setExportEntity(entity.key)}
                  className={`flex items-center gap-2 sm:gap-3 p-3 sm:p-4 rounded-xl border-2 transition text-left ${
                    exportEntity === entity.key
                      ? "border-[#2E7D32] bg-[#E8F5E9]/50"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <span className="text-xl sm:text-2xl">{entity.icon}</span>
                  <span className="text-xs sm:text-sm font-medium text-slate-700">{entity.label}</span>
                </button>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-4 pt-4 border-t border-slate-100">
              <div className="flex-1">
                <p className="text-sm text-slate-600">
                  Export <strong className="text-slate-800">{entityLabel(exportEntity)}</strong> as CSV
                </p>
                <p className="text-xs text-slate-400 mt-0.5">All fields included · UTF-8 encoded</p>
              </div>
              <button
                onClick={handleExport}
                disabled={exporting}
                className="flex items-center justify-center gap-2 px-5 py-2.5 bg-[#2E7D32] text-white text-sm font-medium rounded-lg hover:bg-[#1B5E20] transition disabled:opacity-50"
              >
                {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                {exporting ? "Exporting..." : "Download CSV"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
