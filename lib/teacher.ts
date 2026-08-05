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
