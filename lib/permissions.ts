/**
 * Central permissions configuration for Nitaq Academy CRM + Centre Management System.
 *
 * All role-based access decisions (sidebar, pages, API routes, import/export)
 * are derived from this single file. Never hard-code role checks elsewhere.
 */

export const ALL_ROLES = [
  "admin", "manager", "sales", "finance", "trainer",
  "assessor", "iqa", "eqa",
] as const;
export type AppRole = (typeof ALL_ROLES)[number];

// ── Page-level access ──────────────────────────────────────────────────────
// Maps URL path prefixes to the roles allowed to visit them.
// More specific paths must come before less specific ones (first match wins in middleware).
export const PAGE_PERMISSIONS: { path: string; roles: AppRole[] }[] = [
  // ── Settings — admin only ──────────────────────────────────────────────
  { path: "/settings", roles: ["admin"] },

  // ── Finance / Business ─────────────────────────────────────────────────
  { path: "/finance",   roles: ["admin", "manager", "finance"] },
  { path: "/payments",  roles: ["admin", "manager", "finance"] },
  { path: "/expenses",  roles: ["admin", "manager", "finance"] },
  { path: "/reports",   roles: ["admin", "manager", "finance"] },

  // ── CRM Ops ────────────────────────────────────────────────────────────
  { path: "/leads",               roles: ["admin", "manager", "sales"] },
  { path: "/follow-ups",          roles: ["admin", "manager", "sales"] },
  { path: "/students",            roles: ["admin", "manager"] },
  { path: "/enrollments",         roles: ["admin", "manager", "finance"] },
  { path: "/enrollment-requests", roles: ["admin", "manager", "sales"] },

  // ── Academy Ops ────────────────────────────────────────────────────────
  { path: "/courses",   roles: ["admin", "manager", "sales", "trainer", "assessor", "iqa", "eqa"] },
  { path: "/classes",   roles: ["admin", "manager", "trainer"] },
  { path: "/teachers",  roles: ["admin", "manager"] },

  // ── Centre Management System (new) ────────────────────────────────────
  // Compliance dashboard — all compliance roles + admin/manager
  { path: "/compliance",
    roles: ["admin", "manager", "iqa", "eqa", "assessor"] },
  // Learner compliance profiles
  { path: "/learner-profiles",
    roles: ["admin", "manager", "iqa", "eqa", "assessor"] },
  // Qualification management
  { path: "/qualifications",
    roles: ["admin", "manager", "iqa", "eqa", "assessor", "trainer"] },
  // Assessment tracking
  { path: "/assessments",
    roles: ["admin", "manager", "iqa", "eqa", "assessor"] },
  // IQA module
  { path: "/iqa",
    roles: ["admin", "manager", "iqa", "eqa"] },
  // Staff compliance
  { path: "/staff-compliance",
    roles: ["admin", "manager", "iqa", "eqa"] },
  // Document control
  { path: "/document-control",
    roles: ["admin", "manager", "iqa", "eqa", "assessor"] },

  // ── System ────────────────────────────────────────────────────────────
  { path: "/activity",      roles: ["admin", "manager"] },
  { path: "/import-export", roles: ["admin", "manager", "sales", "finance"] },

  // ── Dashboard — everyone ───────────────────────────────────────────────
  { path: "/dashboard",
    roles: ["admin", "manager", "sales", "finance", "trainer", "assessor", "iqa", "eqa"] },
];

// ── Sidebar navigation visibility ──────────────────────────────────────────
export const SIDEBAR_VISIBILITY: Record<string, AppRole[]> = {
  // CRM Workspace
  "/dashboard":            ["admin", "manager", "sales", "finance", "trainer", "assessor", "iqa", "eqa"],
  "/leads":                ["admin", "manager", "sales"],
  "/follow-ups":           ["admin", "manager", "sales"],
  "/students":             ["admin", "manager"],
  "/courses":              ["admin", "manager", "sales", "trainer", "assessor", "iqa", "eqa"],
  "/teachers":             ["admin", "manager"],
  "/enrollments":          ["admin", "manager", "finance"],
  "/enrollment-requests":  ["admin", "manager", "sales"],
  "/classes":              ["admin", "manager", "trainer"],
  "/finance":              ["admin", "manager", "finance"],
  "/expenses":             ["admin", "manager", "finance"],
  "/reports":              ["admin", "manager", "finance"],
  // Centre Management
  "/compliance":           ["admin", "manager", "iqa", "eqa", "assessor"],
  "/learner-profiles":     ["admin", "manager", "iqa", "eqa", "assessor"],
  "/qualifications":       ["admin", "manager", "iqa", "eqa", "assessor", "trainer"],
  "/assessments":          ["admin", "manager", "iqa", "eqa", "assessor"],
  "/iqa":                  ["admin", "manager", "iqa", "eqa"],
  "/staff-compliance":     ["admin", "manager", "iqa", "eqa"],
  "/document-control":     ["admin", "manager", "iqa", "eqa", "assessor"],
  // System
  "/activity":             ["admin", "manager"],
  "/import-export":        ["admin", "manager", "sales", "finance"],
  "/settings":             ["admin"],
};

// ── API route permissions ───────────────────────────────────────────────────
export const API_PERMISSIONS: Record<string, { read: AppRole[]; write: AppRole[] }> = {
  // Existing CRM
  leads:                { read: ["admin", "manager", "sales"],             write: ["admin", "manager", "sales"] },
  "follow-ups":         { read: ["admin", "manager", "sales"],             write: ["admin", "manager", "sales"] },
  students:             { read: ["admin", "manager"],                       write: ["admin", "manager"] },
  courses:              { read: ["admin", "manager", "sales", "trainer", "assessor", "iqa", "eqa"], write: ["admin", "manager"] },
  teachers:             { read: ["admin", "manager"],                       write: ["admin", "manager"] },
  enrollments:          { read: ["admin", "manager", "finance"],           write: ["admin", "manager"] },
  "enrollment-requests":{ read: ["admin", "manager", "sales"],             write: ["admin", "manager", "sales"] },
  classes:              { read: ["admin", "manager", "trainer"],           write: ["admin", "manager"] },
  attendance:           { read: ["admin", "manager", "trainer"],           write: ["admin", "manager", "trainer"] },
  payments:             { read: ["admin", "manager", "finance"],           write: ["admin", "manager", "finance"] },
  expenses:             { read: ["admin", "manager", "finance"],           write: ["admin", "manager", "finance"] },
  users:                { read: ["admin"],                                  write: ["admin"] },
  seed:                 { read: ["admin"],                                  write: ["admin"] },
  dashboard:            { read: ["admin", "manager", "sales", "finance", "trainer", "assessor", "iqa", "eqa"], write: [] },
  allocations:          { read: ["admin", "manager"],                       write: ["admin", "manager"] },
  subjects:             { read: ["admin", "manager", "trainer"],           write: ["admin", "manager"] },
  // Centre Management System (new)
  "learner-profiles":   { read: ["admin", "manager", "iqa", "eqa", "assessor"], write: ["admin", "manager", "iqa", "assessor"] },
  qualifications:       { read: ["admin", "manager", "iqa", "eqa", "assessor", "trainer"], write: ["admin", "manager", "iqa"] },
  assessments:          { read: ["admin", "manager", "iqa", "eqa", "assessor"], write: ["admin", "manager", "assessor", "iqa"] },
  "iqa-samples":        { read: ["admin", "manager", "iqa", "eqa"],       write: ["admin", "manager", "iqa"] },
  "staff-compliance":   { read: ["admin", "manager", "iqa", "eqa"],       write: ["admin", "manager"] },
  "document-control":   { read: ["admin", "manager", "iqa", "eqa", "assessor"], write: ["admin", "manager", "iqa"] },
  compliance:           { read: ["admin", "manager", "iqa", "eqa", "assessor"], write: [] },
};

// ── Import/Export permissions per entity ───────────────────────────────────
export const IMPORT_EXPORT_PERMISSIONS: Record<string, { import: AppRole[]; export: AppRole[] }> = {
  leads:         { import: ["admin", "manager", "sales"],    export: ["admin", "manager", "sales"] },
  followups:     { import: ["admin", "manager", "sales"],    export: ["admin", "manager", "sales"] },
  enrollments:   { import: ["admin", "manager"],             export: ["admin", "manager", "finance"] },
  courses:       { import: ["admin", "manager"],             export: ["admin", "manager"] },
  teachers:      { import: ["admin", "manager"],             export: ["admin", "manager"] },
  payments:      { import: ["admin", "manager", "finance"],  export: ["admin", "manager", "finance"] },
  expenses:      { import: ["admin", "manager", "finance"],  export: ["admin", "manager", "finance"] },
  attendance:    { import: ["admin", "manager"],             export: ["admin", "manager"] },
};

// ── Role labels ────────────────────────────────────────────────────────────
export const userRoleLabels: Record<AppRole, string> = {
  admin:    "Administrator",
  manager:  "Manager",
  sales:    "Sales",
  finance:  "Finance",
  trainer:  "Trainer",
  assessor: "Assessor",
  iqa:      "IQA",
  eqa:      "EQA",
};

// ── EQA read-only check ────────────────────────────────────────────────────
export function isReadOnlyRole(role: AppRole | string | undefined): boolean {
  return role === "eqa";
}

export function hasRole(userRole: string | undefined, allowed: AppRole[]): boolean {
  if (!userRole) return false;
  return (allowed as string[]).includes(userRole);
}
