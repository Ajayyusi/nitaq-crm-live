/**
 * Central permissions configuration for Nitaq Academy CRM.
 *
 * All role-based access decisions (sidebar, pages, API routes, import/export)
 * are derived from this single file. Never hard-code role checks elsewhere.
 */

export const ALL_ROLES = ["admin", "manager", "sales", "finance", "trainer"] as const;
export type AppRole = (typeof ALL_ROLES)[number];

// ── Page-level access ──────────────────────────────────────────────────────
// Maps URL path prefixes to the roles allowed to visit them.
// More specific paths must come before less specific ones (first match wins in middleware).
export const PAGE_PERMISSIONS: { path: string; roles: AppRole[] }[] = [
  // Settings — admin only
  { path: "/settings", roles: ["admin"] },
  // Finance / Business — admin, manager, finance
  { path: "/finance", roles: ["admin", "manager", "finance"] },
  { path: "/payments", roles: ["admin", "manager", "finance"] },
  { path: "/expenses", roles: ["admin", "manager", "finance"] },
  { path: "/reports", roles: ["admin", "manager", "finance"] },
  // Operations — not accessible to finance or trainer
  { path: "/leads", roles: ["admin", "manager", "sales"] },
  { path: "/follow-ups", roles: ["admin", "manager", "sales"] },
  { path: "/students", roles: ["admin", "manager"] },
  // Enrollments — finance can read; sales uses enrollment-request workflow
  { path: "/enrollments", roles: ["admin", "manager", "finance"] },
  // Enrollment requests — sales submits; admin/manager review
  { path: "/enrollment-requests", roles: ["admin", "manager", "sales"] },
  // Academy ops — trainer can see courses and classes
  { path: "/courses", roles: ["admin", "manager", "sales", "trainer"] },
  { path: "/classes", roles: ["admin", "manager", "trainer"] },
  { path: "/teachers", roles: ["admin", "manager"] },
  // Import/Export — trainers cannot access
  { path: "/import-export", roles: ["admin", "manager", "sales", "finance"] },
  // Activity log — admin and manager only
  { path: "/activity", roles: ["admin", "manager"] },
  // Dashboard — everyone
  { path: "/dashboard", roles: ["admin", "manager", "sales", "finance", "trainer"] },
];

// ── Sidebar navigation visibility ──────────────────────────────────────────
// Controls which links appear in the sidebar per role.
export const SIDEBAR_VISIBILITY: Record<string, AppRole[]> = {
  "/dashboard":     ["admin", "manager", "sales", "finance", "trainer"],
  "/leads":         ["admin", "manager", "sales"],
  "/follow-ups":    ["admin", "manager", "sales"],
  "/students":      ["admin", "manager"],
  "/courses":       ["admin", "manager", "sales", "trainer"],
  "/teachers":      ["admin", "manager"],
  "/enrollments":   ["admin", "manager", "finance"],
  "/enrollment-requests": ["admin", "manager", "sales"],
  "/classes":       ["admin", "manager", "trainer"],
  "/finance":       ["admin", "manager", "finance"],
  "/expenses":      ["admin", "manager", "finance"],
  "/reports":       ["admin", "manager", "finance"],
  "/activity":      ["admin", "manager"],
  "/import-export": ["admin", "manager", "sales", "finance"],
  "/settings":      ["admin"],
};

// ── API route permissions ───────────────────────────────────────────────────
// Each entry maps to the roles allowed to call that API.
// "read" = GET, "write" = POST/PUT/PATCH/DELETE
export const API_PERMISSIONS: Record<string, { read: AppRole[]; write: AppRole[] }> = {
  leads:       { read: ["admin", "manager", "sales"],             write: ["admin", "manager", "sales"] },
  "follow-ups":{ read: ["admin", "manager", "sales"],             write: ["admin", "manager", "sales"] },
  students:    { read: ["admin", "manager"],                       write: ["admin", "manager"] },
  courses:     { read: ["admin", "manager", "sales", "trainer"],  write: ["admin", "manager"] },
  teachers:    { read: ["admin", "manager"],                       write: ["admin", "manager"] },
  enrollments: { read: ["admin", "manager", "finance"],           write: ["admin", "manager"] },
  "enrollment-requests": { read: ["admin", "manager", "sales"],  write: ["admin", "manager", "sales"] },
  classes:     { read: ["admin", "manager", "trainer"],           write: ["admin", "manager"] },
  attendance:  { read: ["admin", "manager", "trainer"],           write: ["admin", "manager", "trainer"] },
  payments:    { read: ["admin", "manager", "finance"],           write: ["admin", "manager", "finance"] },
  expenses:    { read: ["admin", "manager", "finance"],           write: ["admin", "manager", "finance"] },
  users:       { read: ["admin"],                                  write: ["admin"] },
  seed:        { read: ["admin"],                                  write: ["admin"] },
  dashboard:   { read: ["admin", "manager", "sales", "finance", "trainer"], write: [] },
  allocations: { read: ["admin", "manager"],                       write: ["admin", "manager"] },
  subjects:    { read: ["admin", "manager", "trainer"],           write: ["admin", "manager"] },
};

// ── Import/Export permissions per entity ───────────────────────────────────
// Controls which roles can import and/or export each entity type.
export const IMPORT_EXPORT_PERMISSIONS: Record<string, { import: AppRole[]; export: AppRole[] }> = {
  leads:       { import: ["admin", "manager", "sales"],    export: ["admin", "manager", "sales"] },
  followups:   { import: ["admin", "manager", "sales"],    export: ["admin", "manager", "sales"] },
  enrollments: { import: ["admin", "manager"],             export: ["admin", "manager", "finance"] },
  // Sales-only: leads + followups (filtered to own records at API level)
  courses:     { import: ["admin", "manager"],             export: ["admin", "manager"] },
  teachers:    { import: ["admin", "manager"],             export: ["admin", "manager"] },
  payments:    { import: ["admin", "manager", "finance"],  export: ["admin", "manager", "finance"] },
  expenses:    { import: ["admin", "manager", "finance"],  export: ["admin", "manager", "finance"] },
  attendance:  { import: ["admin", "manager"],             export: ["admin", "manager"] },
};

export const userRoleLabels: Record<AppRole, string> = {
  admin:   "Administrator",
  manager: "Manager",
  sales:   "Sales",
  finance: "Finance",
  trainer: "Trainer",
};

export function hasRole(userRole: string | undefined, allowed: AppRole[]): boolean {
  if (!userRole) return false;
  return (allowed as string[]).includes(userRole);
}
