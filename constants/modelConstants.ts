// Shared constants extracted from Mongoose model files.
// Import these in client components — do NOT import from models/* directly.

// ── FollowUp ──────────────────────────────────────────────────────────────────
export const followUpTypes = [
  "WhatsApp Message",
  "Phone Call",
  "Send Brochure",
  "Send Pricing",
  "In-Person",
  "Email",
  "Other",
] as const;

export const followUpStatuses = [
  "Pending",
  "Done",
  "No Response",
  "Rescheduled",
] as const;

export type FollowUpType = (typeof followUpTypes)[number];
export type FollowUpStatus = (typeof followUpStatuses)[number];

// ── Course ────────────────────────────────────────────────────────────────────
export const courseCategories = [
  "Computer Software Training",
  "Business & Admin Training",
  "Supportive Education",
  "Language",
] as const;

export const courseStatuses = ["Active", "Coming Soon", "Inactive"] as const;
export const batchFormats = ["In-Person", "Online", "Hybrid"] as const;
export const batchStatuses = ["Open", "In Progress", "Completed", "Cancelled"] as const;

// ── Teacher ───────────────────────────────────────────────────────────────────
export const trainerStatuses = ["Active", "Inactive"] as const;
export const tamamStatuses = ["Registered", "Pending", "Not Registered"] as const;
export const contractStatuses = ["Active", "Expired", "No Contract"] as const;
// Renamed from paymentTypes to avoid collision with Financial paymentTypes below
export const trainerPaymentTypes = ["Per Session", "Per Course", "Monthly"] as const;

// ── Financial (Payments) ──────────────────────────────────────────────────────
export const paymentMethods = [
  "Bank Transfer",
  "Cash",
  "Card",
  "Cheque",
  "Online",
  "Tabby",
] as const;

export const paymentTypes = [
  "Full Payment",
  "Instalment 1 of 2",
  "Instalment 2 of 2",
  "Deposit",
  "Refund",
] as const;

export const txStatuses = ["Received", "Pending", "Overdue", "Refunded"] as const;

// ── Financial (Expenses) ──────────────────────────────────────────────────────
export const expenseCategories = [
  "Rent",
  "Salaries",
  "Utilities",
  "Marketing",
  "Supplies",
  "Maintenance",
  "Insurance",
  "Training Materials",
  "Software & Subscriptions",
  "Equipment",
  "Transport",
  "Government Fees",
  "Other",
] as const;

export const expensePaymentMethods = [
  "Cash",
  "Bank Transfer",
  "Card",
  "Cheque",
  "Online",
] as const;

// ── Attendance ────────────────────────────────────────────────────────────────
export const attendanceStatuses = ["Present", "Absent", "Late", "Excused"] as const;

// ── Enrollment ────────────────────────────────────────────────────────────────
export const enrollmentStatuses = ["Active", "Completed", "Dropped", "On Hold"] as const;

export const paymentStatuses = [
  "Paid Full",
  "Instalment 1 Paid",
  "Instalment 2 Pending",
  "Overdue",
  "Free",
] as const;

export const scheduleFormats = ["In-Person", "Online", "Hybrid"] as const;
