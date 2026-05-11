import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency = "AED") {
  return new Intl.NumberFormat("en-AE", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(date: Date | string) {
  return new Date(date).toLocaleDateString("en-AE", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatDateTime(date: Date | string) {
  return new Date(date).toLocaleString("en-AE", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^\w ]+/g, "")
    .replace(/ +/g, "-");
}

export const LEAD_STATUSES = [
  "new",
  "contacted",
  "trial_booked",
  "trial_done",
  "enrolled",
  "lost",
  "on_hold",
] as const;

export const ENROLLMENT_STATUSES = [
  "active",
  "completed",
  "paused",
  "cancelled",
] as const;

export const TEACHER_STATUSES = ["active", "inactive", "on_leave"] as const;

export const PAYMENT_METHODS = [
  "cash",
  "bank_transfer",
  "card",
  "cheque",
  "online",
] as const;

export const MODES = ["online", "offline", "hybrid"] as const;

export const LEAD_SOURCES = [
  "walk_in",
  "referral",
  "instagram",
  "facebook",
  "google",
  "website",
  "whatsapp",
  "other",
] as const;

export const DAYS_OF_WEEK = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export const ROLES = [
  "super_admin",
  "admin",
  "sales",
  "teacher",
  "finance",
  "academic",
] as const;

export type Role = (typeof ROLES)[number];
