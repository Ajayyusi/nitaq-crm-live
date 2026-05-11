import { Role } from "@/lib/utils";

export type Permission =
  | "leads:read"
  | "leads:write"
  | "leads:delete"
  | "students:read"
  | "students:write"
  | "teachers:read"
  | "teachers:write"
  | "teachers:delete"
  | "courses:read"
  | "courses:write"
  | "courses:delete"
  | "subjects:read"
  | "subjects:write"
  | "allocations:read"
  | "allocations:write"
  | "enrollments:read"
  | "enrollments:write"
  | "classes:read"
  | "classes:write"
  | "attendance:read"
  | "attendance:write"
  | "payments:read"
  | "payments:write"
  | "expenses:read"
  | "expenses:write"
  | "payroll:read"
  | "payroll:write"
  | "reports:read"
  | "import_export:read"
  | "import_export:write"
  | "settings:read"
  | "settings:write"
  | "users:read"
  | "users:write"
  | "audit_log:read";

const PERMISSIONS: Record<Role, Permission[]> = {
  super_admin: [
    "leads:read", "leads:write", "leads:delete",
    "students:read", "students:write",
    "teachers:read", "teachers:write", "teachers:delete",
    "courses:read", "courses:write", "courses:delete",
    "subjects:read", "subjects:write",
    "allocations:read", "allocations:write",
    "enrollments:read", "enrollments:write",
    "classes:read", "classes:write",
    "attendance:read", "attendance:write",
    "payments:read", "payments:write",
    "expenses:read", "expenses:write",
    "payroll:read", "payroll:write",
    "reports:read",
    "import_export:read", "import_export:write",
    "settings:read", "settings:write",
    "users:read", "users:write",
    "audit_log:read",
  ],
  admin: [
    "leads:read", "leads:write", "leads:delete",
    "students:read", "students:write",
    "teachers:read", "teachers:write",
    "courses:read", "courses:write", "courses:delete",
    "subjects:read", "subjects:write",
    "allocations:read", "allocations:write",
    "enrollments:read", "enrollments:write",
    "classes:read", "classes:write",
    "attendance:read", "attendance:write",
    "payments:read", "payments:write",
    "expenses:read", "expenses:write",
    "payroll:read", "payroll:write",
    "reports:read",
    "import_export:read", "import_export:write",
    "settings:read", "settings:write",
  ],
  sales: [
    "leads:read", "leads:write",
    "students:read",
    "teachers:read",
    "courses:read",
    "subjects:read",
    "allocations:read", "allocations:write",
    "enrollments:read",
    "classes:read",
  ],
  teacher: [
    "classes:read",
    "attendance:read", "attendance:write",
    "students:read",
    "courses:read",
    "subjects:read",
  ],
  finance: [
    "enrollments:read",
    "payments:read", "payments:write",
    "expenses:read", "expenses:write",
    "payroll:read", "payroll:write",
    "reports:read",
    "students:read",
  ],
  academic: [
    "leads:read",
    "students:read",
    "teachers:read", "teachers:write",
    "courses:read",
    "subjects:read",
    "allocations:read", "allocations:write",
    "enrollments:read", "enrollments:write",
    "classes:read", "classes:write",
    "attendance:read", "attendance:write",
    "reports:read",
  ],
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return PERMISSIONS[role]?.includes(permission) ?? false;
}

export function getRolePermissions(role: Role): Permission[] {
  return PERMISSIONS[role] ?? [];
}

export const ROLE_LABELS: Record<Role, string> = {
  super_admin: "Super Admin",
  admin: "Admin / Operations",
  sales: "Sales User",
  teacher: "Teacher",
  finance: "Accounts / Finance",
  academic: "Academic Coordinator",
};

export const ROLE_COLORS: Record<Role, string> = {
  super_admin: "bg-purple-100 text-purple-700",
  admin: "bg-blue-100 text-blue-700",
  sales: "bg-green-100 text-green-700",
  teacher: "bg-amber-100 text-amber-700",
  finance: "bg-rose-100 text-rose-700",
  academic: "bg-teal-100 text-teal-700",
};
