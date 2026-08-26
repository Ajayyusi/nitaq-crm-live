import Teacher, { type ITeacher } from "@/models/Teacher";
import type { AuthedUser } from "@/lib/api-auth";

/**
 * Resolve the Teacher record for a logged-in trainer user.
 * The link is the login account's email matching the Teacher record's email.
 */
export async function getTeacherForUser(authed: AuthedUser): Promise<ITeacher | null> {
  if (!authed.email) return null;
  return Teacher.findOne({ email: authed.email.toLowerCase() });
}

/**
 * Match enrollments taught by this trainer.
 *
 * A registration may have several trainers: `teacherId` is the primary and
 * `teacherIds` holds every assigned trainer. Matching both means a
 * co-teaching trainer sees the student, and records written before
 * multi-trainer support still match on the scalar field alone.
 */
export function taughtByFilter(teacherId: unknown) {
  return { $or: [{ teacherId }, { teacherIds: teacherId }] };
}

/**
 * Normalize a trainer selection into the stored shape: a de-duplicated list
 * plus the primary scalar mirroring the first entry. Passing an empty list
 * clears the assignment.
 */
export function resolveTeacherAssignment(
  ids: string[],
  nameOf: (id: string) => string | undefined
): { teacherId?: string; teacherName?: string; teacherIds: string[]; teacherNames: string[] } {
  const unique = [...new Set(ids.filter(Boolean))];
  const names = unique.map((id) => nameOf(id) ?? "");
  return {
    teacherId: unique[0],
    teacherName: names[0] || undefined,
    teacherIds: unique,
    teacherNames: names,
  };
}

/**
 * Merge the taught-by scope into an existing query without clobbering it.
 *
 * Callers often already use `$or` for text search, so the scope goes in via
 * `$and` — assigning `$or` directly would silently drop the search filter.
 */
export function applyTaughtBy<T extends Record<string, unknown>>(query: T, teacherId: unknown): T {
  const existing = Array.isArray(query.$and) ? (query.$and as unknown[]) : [];
  (query as Record<string, unknown>).$and = [...existing, taughtByFilter(teacherId)];
  return query;
}

/** Is this trainer assigned to the registration — primary or co-teaching? */
export function isTaughtBy(
  enrollment: { teacherId?: unknown; teacherIds?: unknown[] } | null,
  teacherId: unknown
): boolean {
  if (!enrollment) return false;
  const target = String(teacherId);
  if (enrollment.teacherId && String(enrollment.teacherId) === target) return true;
  return (enrollment.teacherIds ?? []).some((id) => String(id) === target);
}
