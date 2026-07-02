// Field-whitelist for qualification unit sub-documents coming from the client.
export function sanitizeUnits(raw: unknown) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((u) => u && typeof u === "object")
    .map((u: Record<string, unknown>) => ({
      unitCode:           String(u.unitCode ?? "").trim(),
      unitTitle:          String(u.unitTitle ?? "").trim(),
      level:              String(u.level ?? "").trim() || undefined,
      credits:            u.credits != null && u.credits !== "" ? Number(u.credits) : undefined,
      glh:                u.glh != null && u.glh !== "" ? Number(u.glh) : undefined,
      learningOutcomes:   String(u.learningOutcomes ?? "").trim() || undefined,
      assessmentCriteria: String(u.assessmentCriteria ?? "").trim() || undefined,
      isMandatory:        u.isMandatory !== false,
    }))
    .filter((u) => u.unitCode && u.unitTitle);
}
