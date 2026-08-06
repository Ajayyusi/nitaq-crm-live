"use client";

import { useState, useRef } from "react";
import {
  Upload, Download, FileText, AlertCircle, CheckCircle2, X, Target,
  CalendarClock, GraduationCap, ClipboardList, BookOpen, UserCog,
  CreditCard, TrendingDown, School, type LucideIcon,
} from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import Papa from "papaparse";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Field, Select } from "@/components/ui/input";
import { Spinner } from "@/components/ui/feedback";
import { Table, THead, Th, Tr, Td } from "@/components/ui/table";
import { IMPORT_EXPORT_PERMISSIONS, hasRole } from "@/lib/permissions";
import type { AppRole } from "@/lib/permissions";
import { cn } from "@/lib/utils";

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
      paymentRate: "150", paymentType: "Per Hour", status: "Active", notes: "",
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

const ALL_ENTITIES: { key: string; label: string; icon: LucideIcon }[] = [
  { key: "leads", label: "Leads", icon: Target },
  { key: "followups", label: "Follow-ups", icon: CalendarClock },
  { key: "students", label: "Students", icon: GraduationCap },
  { key: "enrollments", label: "Enrollments", icon: ClipboardList },
  { key: "courses", label: "Courses", icon: BookOpen },
  { key: "teachers", label: "Teachers", icon: UserCog },
  { key: "payments", label: "Payments", icon: CreditCard },
  { key: "expenses", label: "Expenses", icon: TrendingDown },
  { key: "classes", label: "Classes", icon: School },
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
  const [exportNotice, setExportNotice] = useState<{ tone: "caution" | "alert"; text: string } | null>(null);
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
    setExportNotice(null);
    try {
      const res = await fetch(`/api/export/${exportEntity}`);
      const data = await res.json();
      const rows = data.rows ?? [];
      if (!rows.length) {
        setExportNotice({ tone: "caution", text: "No data to export for this section." });
        setExporting(false);
        return;
      }
      const csv = Papa.unparse(rows);
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `nitaq_${exportEntity}_${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setExportNotice({ tone: "alert", text: "Export failed. Check your connection and try again." });
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
    <div>
      <PageHeader title="Import / Export" subtitle="Bulk data management via CSV" />

      {/* Tabs */}
      <div className="mb-5 flex gap-1 border-b border-bezel" role="tablist" aria-label="Import or export">
        {(["import", "export"] as const).map((tab) => (
          <button
            key={tab}
            role="tab"
            aria-selected={activeTab === tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "-mb-px flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-bold uppercase tracking-[0.08em] transition-colors",
              activeTab === tab
                ? "border-phos text-phos"
                : "border-transparent text-dim hover:text-ink"
            )}
          >
            {tab === "import"
              ? <Upload className="h-3.5 w-3.5" aria-hidden />
              : <Download className="h-3.5 w-3.5" aria-hidden />}
            {tab === "import" ? "Import Data" : "Export Data"}
          </button>
        ))}
      </div>

      <div className="max-w-4xl space-y-4">
        {activeTab === "import" && (
          <>
            {/* Step 1: Templates */}
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>Step 1 — Download Template</CardTitle>
                  <CardDescription className="mt-0.5">
                    Download the CSV template for the section you want to import, fill in your data, then upload below. Maximum 500 rows per import.
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 sm:gap-3">
                  {importEntities.map((ent) => (
                    <button
                      key={ent.key}
                      onClick={() => downloadTemplate(ent.key)}
                      aria-label={`Download ${ent.label} template`}
                      className="group flex flex-col items-center gap-1.5 rounded-ctl border border-bezel p-2.5 transition-colors hover:border-phos hover:bg-well sm:p-3"
                    >
                      <FileText className="h-4 w-4 text-faint transition-colors group-hover:text-phos sm:h-5 sm:w-5" aria-hidden />
                      <span className="text-center text-xs font-medium leading-tight text-dim group-hover:text-ink">{ent.label}</span>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Step 2: Upload */}
            <Card>
              <CardHeader>
                <CardTitle>Step 2 — Upload CSV</CardTitle>
              </CardHeader>
              <CardContent>
                <Field label="Import Type" htmlFor="importType" className="mb-4 sm:max-w-64">
                  <Select
                    id="importType"
                    value={importEntity}
                    onChange={(e) => { setImportEntity(e.target.value); resetImport(); }}
                  >
                    {importEntities.map((e) => (
                      <option key={e.key} value={e.key}>{e.label}</option>
                    ))}
                  </Select>
                </Field>

                {["teachers", "followups", "classes"].includes(importEntity) && (
                  <div
                    role="alert"
                    className="mb-4 flex items-start gap-2 rounded-ctl border border-caution/30 bg-[var(--lamp-caution-bg)] p-3 text-xs text-caution"
                  >
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" aria-hidden />
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
                  className={cn(
                    "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-card border-2 border-dashed p-6 transition-colors sm:p-8",
                    csvFile ? "border-phos/60 bg-well" : "border-bezel-strong hover:border-phos/60 hover:bg-well"
                  )}
                >
                  <Upload className={cn("h-7 w-7 sm:h-8 sm:w-8", csvFile ? "text-phos" : "text-faint")} aria-hidden />
                  {csvFile ? (
                    <div className="text-center">
                      <p className="text-sm font-semibold text-phos">{csvFile.name}</p>
                      <p className="readout text-xs text-dim" data-numeric>{parsedRows.length} rows parsed</p>
                    </div>
                  ) : (
                    <div className="text-center">
                      <p className="text-sm font-semibold text-ink">Tap to upload CSV file</p>
                      <p className="text-xs text-faint">or drag and drop</p>
                    </div>
                  )}
                </label>
              </CardContent>
            </Card>

            {/* Step 3: Review & Import */}
            {(parsedRows.length > 0 || parseErrors.length > 0) && !importResult && (
              <Card>
                <CardHeader>
                  <CardTitle>Step 3 — Review &amp; Import</CardTitle>
                </CardHeader>
                <CardContent>
                  {parseErrors.length > 0 && (
                    <div role="alert" className="mb-4 rounded-ctl border border-alert/30 bg-[var(--lamp-alert-bg)] p-4">
                      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-alert">
                        <AlertCircle className="h-4 w-4 flex-shrink-0" aria-hidden /> Validation Errors ({parseErrors.length})
                      </div>
                      <ul className="space-y-1">
                        {parseErrors.slice(0, 10).map((err, i) => (
                          <li key={i} className="text-xs text-alert">{err}</li>
                        ))}
                        {parseErrors.length > 10 && <li className="text-xs text-dim">…and {parseErrors.length - 10} more</li>}
                      </ul>
                    </div>
                  )}

                  <div className="mb-4 flex flex-col justify-between gap-3 rounded-ctl bg-well p-4 sm:flex-row sm:items-center">
                    <div className="text-sm text-dim">
                      <span className="readout font-bold text-ink" data-numeric>{parsedRows.length}</span> rows ready to import into <span className="font-semibold text-ink">{entityLabel(importEntity)}</span>
                      {parseErrors.length > 0 && <span className="ml-2 text-alert">({parseErrors.length} with errors)</span>}
                    </div>
                    <div className="flex gap-2">
                      <Button variant="secondary" size="sm" onClick={resetImport}>
                        <X className="h-3.5 w-3.5" aria-hidden /> Clear
                      </Button>
                      <Button
                        variant="solid"
                        size="sm"
                        onClick={() => void handleImport()}
                        disabled={importing || parsedRows.length === 0 || parseErrors.length > 0}
                      >
                        {importing ? <Spinner className="h-3.5 w-3.5" /> : <Upload className="h-3.5 w-3.5" aria-hidden />}
                        {importing ? "Importing…" : `Import ${parsedRows.length} Rows`}
                      </Button>
                    </div>
                  </div>

                  {/* Preview table */}
                  <div className="max-h-56 overflow-auto rounded-ctl border border-bezel">
                    <Table className="text-xs">
                      <THead>
                        <tr>
                          {parsedRows[0] && Object.keys(parsedRows[0]).map((k) => (
                            <Th key={k}>{k}</Th>
                          ))}
                        </tr>
                      </THead>
                      <tbody>
                        {parsedRows.slice(0, 5).map((row, i) => (
                          <Tr key={i}>
                            {Object.values(row).map((val, j) => (
                              <Td key={j} className="max-w-32 truncate whitespace-nowrap text-dim" title={String(val)}>
                                {String(val)}
                              </Td>
                            ))}
                          </Tr>
                        ))}
                      </tbody>
                    </Table>
                    {parsedRows.length > 5 && (
                      <p className="py-2 text-center text-xs text-faint">…and {parsedRows.length - 5} more rows</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Import Result */}
            {importResult && (
              <Card className={importResult.failed === 0 ? "border-phos/30" : "border-caution/30"}>
                <CardHeader>
                  <CardTitle className={cn("flex items-center gap-2", importResult.failed === 0 ? "text-phos" : "text-caution")}>
                    <CheckCircle2 className="h-5 w-5" aria-hidden />
                    Import Complete
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="mb-4 grid grid-cols-3 gap-3">
                    <div className="rounded-ctl bg-well p-3 text-center">
                      <p className="readout text-xl font-bold text-ink sm:text-2xl" data-numeric>{importResult.total}</p>
                      <p className="placard mt-1">Total</p>
                    </div>
                    <div className="rounded-ctl border border-phos/30 bg-[var(--lamp-ok-bg)] p-3 text-center">
                      <p className="readout text-xl font-bold text-phos sm:text-2xl" data-numeric>{importResult.success}</p>
                      <p className="placard mt-1">Imported</p>
                    </div>
                    <div className="rounded-ctl border border-alert/30 bg-[var(--lamp-alert-bg)] p-3 text-center">
                      <p className="readout text-xl font-bold text-alert sm:text-2xl" data-numeric>{importResult.failed}</p>
                      <p className="placard mt-1">Failed</p>
                    </div>
                  </div>
                  {importResult.errors.length > 0 && (
                    <div role="alert" className="mb-4 rounded-ctl border border-alert/30 bg-[var(--lamp-alert-bg)] p-3">
                      <p className="mb-1 text-xs font-bold text-alert">Failed rows:</p>
                      {importResult.errors.map((e, i) => (
                        <p key={i} className="text-xs text-alert">Row {e.row}: {e.error}</p>
                      ))}
                    </div>
                  )}
                  <Button variant="secondary" size="sm" onClick={resetImport}>
                    Import Another File
                  </Button>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {activeTab === "export" && (
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Export Data as CSV</CardTitle>
                <CardDescription className="mt-0.5">Select a section and download all records as a CSV file.</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3" role="radiogroup" aria-label="Section to export">
                {exportEntities.map((entity) => {
                  const EntityIcon = entity.icon;
                  const selected = exportEntity === entity.key;
                  return (
                    <button
                      key={entity.key}
                      role="radio"
                      aria-checked={selected}
                      onClick={() => { setExportEntity(entity.key); setExportNotice(null); }}
                      className={cn(
                        "flex items-center gap-2 rounded-ctl border p-3 text-left transition-colors sm:gap-3 sm:p-4",
                        selected
                          ? "border-phos bg-well shadow-glow"
                          : "border-bezel hover:border-bezel-strong hover:bg-well"
                      )}
                    >
                      <EntityIcon className={cn("h-5 w-5 flex-shrink-0", selected ? "text-phos" : "text-faint")} aria-hidden />
                      <span className={cn("text-xs font-semibold sm:text-sm", selected ? "text-ink" : "text-dim")}>{entity.label}</span>
                    </button>
                  );
                })}
              </div>

              {exportNotice && (
                <div
                  role="alert"
                  className={cn(
                    "flex items-start gap-2 rounded-ctl border p-3 text-xs",
                    exportNotice.tone === "alert"
                      ? "border-alert/30 bg-[var(--lamp-alert-bg)] text-alert"
                      : "border-caution/30 bg-[var(--lamp-caution-bg)] text-caution"
                  )}
                >
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" aria-hidden />
                  <span>{exportNotice.text}</span>
                </div>
              )}

              <div className="flex flex-col gap-4 border-t border-bezel pt-4 sm:flex-row sm:items-center">
                <div className="flex-1">
                  <p className="text-sm text-dim">
                    Export <strong className="text-ink">{entityLabel(exportEntity)}</strong> as CSV
                  </p>
                  <p className="mt-0.5 text-xs text-faint">All fields included · UTF-8 encoded</p>
                </div>
                <Button variant="solid" onClick={() => void handleExport()} disabled={exporting}>
                  {exporting ? <Spinner className="h-4 w-4" /> : <Download className="h-4 w-4" aria-hidden />}
                  {exporting ? "Exporting…" : "Download CSV"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
