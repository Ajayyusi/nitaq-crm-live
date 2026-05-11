"use client";

import { useState, useRef } from "react";
import { Upload, Download, FileText, AlertCircle, CheckCircle, X, Loader2 } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import Papa from "papaparse";

// CSV templates for each entity
const TEMPLATES: Record<string, { fields: string[]; example: Record<string, string> }> = {
  teachers: {
    fields: ["fullName", "phone", "whatsapp", "email", "jobTitle", "employmentType", "status", "branchPreference", "notes"],
    example: { fullName: "Ahmed Al-Rashidi", phone: "+971501234567", whatsapp: "+971501234567", email: "ahmed@email.com", jobTitle: "SAT Math Tutor", employmentType: "part_time", status: "active", branchPreference: "Main Branch", notes: "" },
  },
  students: {
    fields: ["fullName", "phone", "parentPhone", "email", "school", "grade", "notes"],
    example: { fullName: "Sara Ahmed", phone: "+971501234567", parentPhone: "+971501234568", email: "sara@email.com", school: "Al Mawakeb School", grade: "Grade 10", notes: "" },
  },
  leads: {
    fields: ["studentName", "studentPhone", "parentPhone", "email", "mode", "leadSource", "preferredTime", "notes"],
    example: { studentName: "Mohammed Ali", studentPhone: "+971501234567", parentPhone: "+971501234568", email: "student@email.com", mode: "offline", leadSource: "instagram", preferredTime: "Weekday evenings", notes: "" },
  },
  payments: {
    fields: ["studentPhone", "amount", "paymentMethod", "paymentDate", "notes"],
    example: { studentPhone: "+971501234567", amount: "2500", paymentMethod: "cash", paymentDate: "2024-01-15", notes: "Full payment" },
  },
  expenses: {
    fields: ["category", "amount", "expenseDate", "payee", "description"],
    example: { category: "rent", amount: "5000", expenseDate: "2024-01-01", payee: "Building Owner LLC", description: "Monthly office rent" },
  },
};

const EXPORT_ENTITIES = [
  { key: "leads", label: "Leads", icon: "📊" },
  { key: "students", label: "Students", icon: "🎓" },
  { key: "teachers", label: "Teachers", icon: "👨‍🏫" },
  { key: "enrollments", label: "Enrollments", icon: "📋" },
  { key: "payments", label: "Payments", icon: "💰" },
  { key: "expenses", label: "Expenses", icon: "📉" },
];

const IMPORT_ENTITIES = Object.keys(TEMPLATES);

interface ImportResult {
  total: number;
  success: number;
  failed: number;
  errors: { row: number; error: string }[];
}

export default function ImportExportPage() {
  const [activeTab, setActiveTab] = useState<"import" | "export">("import");
  const [importEntity, setImportEntity] = useState("leads");
  const [exportEntity, setExportEntity] = useState("leads");
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<any[]>([]);
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
        const requiredFields = template.fields.slice(0, 2); // first 2 are required

        results.data.forEach((row: any, i: number) => {
          requiredFields.forEach((field) => {
            if (!row[field]) errors.push(`Row ${i + 2}: missing "${field}"`);
          });
        });

        setParsedRows(results.data as any[]);
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
      const rows = data.rows || [];
      if (!rows.length) { alert("No data to export."); setExporting(false); return; }
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

  return (
    <div className="flex flex-col min-h-screen">
      <PageHeader title="Import / Export Center" subtitle="Bulk data management via CSV" />

      {/* Tabs */}
      <div className="bg-white border-b border-slate-200 px-6">
        <div className="flex gap-0">
          {(["import", "export"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-3.5 text-sm font-medium border-b-2 transition capitalize ${
                activeTab === tab
                  ? "border-blue-600 text-blue-700"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              {tab === "import" ? "⬆️" : "⬇️"} {tab.charAt(0).toUpperCase() + tab.slice(1)} Data
            </button>
          ))}
        </div>
      </div>

      <div className="p-6 max-w-4xl space-y-6">
        {activeTab === "import" && (
          <>
            {/* Templates */}
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h3 className="font-semibold text-slate-800 mb-1">Step 1 — Download Template</h3>
              <p className="text-sm text-slate-500 mb-4">Download the CSV template for the entity you want to import, fill in your data, then upload it below.</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                {IMPORT_ENTITIES.map((entity) => (
                  <button
                    key={entity}
                    onClick={() => downloadTemplate(entity)}
                    className="flex flex-col items-center gap-2 p-3 rounded-xl border border-slate-200 hover:border-blue-300 hover:bg-blue-50 transition group"
                  >
                    <FileText className="w-5 h-5 text-slate-400 group-hover:text-blue-600 transition" />
                    <span className="text-xs font-medium text-slate-600 capitalize">{entity}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Entity selector + Upload */}
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h3 className="font-semibold text-slate-800 mb-4">Step 2 — Upload CSV</h3>
              <div className="flex gap-4 mb-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Import Type</label>
                  <select
                    value={importEntity}
                    onChange={(e) => { setImportEntity(e.target.value); resetImport(); }}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {IMPORT_ENTITIES.map((e) => (
                      <option key={e} value={e}>{e.charAt(0).toUpperCase() + e.slice(1)}</option>
                    ))}
                  </select>
                </div>
              </div>

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
                className={`flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-xl p-8 cursor-pointer transition ${
                  csvFile ? "border-blue-400 bg-blue-50" : "border-slate-300 hover:border-blue-400 hover:bg-slate-50"
                }`}
              >
                <Upload className={`w-8 h-8 ${csvFile ? "text-blue-500" : "text-slate-400"}`} />
                {csvFile ? (
                  <div className="text-center">
                    <p className="text-sm font-medium text-blue-700">{csvFile.name}</p>
                    <p className="text-xs text-blue-500">{parsedRows.length} rows parsed</p>
                  </div>
                ) : (
                  <div className="text-center">
                    <p className="text-sm font-medium text-slate-700">Click to upload CSV file</p>
                    <p className="text-xs text-slate-400">or drag and drop</p>
                  </div>
                )}
              </label>
            </div>

            {/* Validation */}
            {(parsedRows.length > 0 || parseErrors.length > 0) && !importResult && (
              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <h3 className="font-semibold text-slate-800 mb-4">Step 3 — Review & Import</h3>

                {parseErrors.length > 0 && (
                  <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-center gap-2 text-red-700 font-medium text-sm mb-2">
                      <AlertCircle className="w-4 h-4" /> Validation Errors ({parseErrors.length})
                    </div>
                    <ul className="space-y-1">
                      {parseErrors.slice(0, 10).map((err, i) => (
                        <li key={i} className="text-xs text-red-600">{err}</li>
                      ))}
                      {parseErrors.length > 10 && <li className="text-xs text-red-400">...and {parseErrors.length - 10} more</li>}
                    </ul>
                  </div>
                )}

                <div className="flex items-center justify-between mb-4 p-4 bg-slate-50 rounded-lg">
                  <div className="text-sm text-slate-600">
                    <span className="font-semibold text-slate-800">{parsedRows.length}</span> rows ready to import
                    {parseErrors.length > 0 && <span className="text-red-500 ml-2">({parseErrors.length} with errors)</span>}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={resetImport} className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg hover:bg-white transition flex items-center gap-1">
                      <X className="w-3.5 h-3.5" /> Clear
                    </button>
                    <button
                      onClick={handleImport}
                      disabled={importing || parsedRows.length === 0}
                      className="px-4 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 flex items-center gap-1.5"
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
                          {Object.values(row).map((val: any, j) => (
                            <td key={j} className="px-3 py-2 text-slate-600 whitespace-nowrap max-w-32 truncate">{val}</td>
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

            {/* Result */}
            {importResult && (
              <div className={`bg-white rounded-xl border p-6 ${importResult.failed === 0 ? "border-green-200" : "border-amber-200"}`}>
                <div className={`flex items-center gap-2 mb-4 font-semibold ${importResult.failed === 0 ? "text-green-700" : "text-amber-700"}`}>
                  <CheckCircle className="w-5 h-5" />
                  Import Complete
                </div>
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div className="bg-slate-50 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-slate-800">{importResult.total}</p>
                    <p className="text-xs text-slate-400">Total Rows</p>
                  </div>
                  <div className="bg-green-50 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-green-700">{importResult.success}</p>
                    <p className="text-xs text-green-500">Imported</p>
                  </div>
                  <div className="bg-red-50 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-red-600">{importResult.failed}</p>
                    <p className="text-xs text-red-400">Failed</p>
                  </div>
                </div>
                {importResult.errors.length > 0 && (
                  <div className="p-3 bg-red-50 rounded-lg">
                    <p className="text-xs font-semibold text-red-700 mb-1">Failed rows:</p>
                    {importResult.errors.map((e, i) => (
                      <p key={i} className="text-xs text-red-600">Row {e.row}: {e.error}</p>
                    ))}
                  </div>
                )}
                <button onClick={resetImport} className="mt-4 px-4 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 transition">
                  Import Another File
                </button>
              </div>
            )}
          </>
        )}

        {activeTab === "export" && (
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-6">
            <div>
              <h3 className="font-semibold text-slate-800 mb-1">Export Data as CSV</h3>
              <p className="text-sm text-slate-500">Select an entity and download all records as a CSV file.</p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {EXPORT_ENTITIES.map((entity) => (
                <button
                  key={entity.key}
                  onClick={() => setExportEntity(entity.key)}
                  className={`flex items-center gap-3 p-4 rounded-xl border-2 transition ${
                    exportEntity === entity.key
                      ? "border-blue-500 bg-blue-50"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <span className="text-2xl">{entity.icon}</span>
                  <span className="text-sm font-medium text-slate-700">{entity.label}</span>
                </button>
              ))}
            </div>

            <div className="flex items-center gap-4 pt-4 border-t border-slate-100">
              <div className="flex-1">
                <p className="text-sm text-slate-600">
                  Export <strong className="text-slate-800 capitalize">{exportEntity}</strong> as CSV
                </p>
                <p className="text-xs text-slate-400 mt-0.5">All fields included · UTF-8 encoded</p>
              </div>
              <button
                onClick={handleExport}
                disabled={exporting}
                className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
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
