import AuditLog from "@/models/AuditLog";

interface AuditParams {
  userName: string;
  userRole: string;
  action: string;
  entity: string;
  entityId: string;
  entityLabel: string;
  detail?: string;
}

/**
 * Write an audit event. Callers must `await` it.
 *
 * It used to be fire-and-forget, which loses events on serverless: once the
 * response is sent the invocation can be frozen before the insert lands, so a
 * payment or role change could succeed with no trail at all.
 *
 * It never throws. By the time it runs, the business write it describes has
 * already committed, so failing the request would tell the user an operation
 * failed when it actually happened. A failed write is logged at error level
 * with the full event instead, so it shows in the platform logs and can be
 * re-entered.
 */
export async function logAudit(params: AuditParams): Promise<void> {
  // Clip to the AuditLog schema limits — an over-long label or detail used to
  // fail validation and vanish. A required field left empty gets a placeholder.
  const fit = (v: string | undefined, max: number, fallback = "-") =>
    (String(v ?? "").trim() || fallback).slice(0, max);
  const event = {
    userName: fit(params.userName, 120, "unknown"),
    userRole: fit(params.userRole, 40, "unknown"),
    action: fit(params.action, 40),
    entity: fit(params.entity, 40),
    entityId: fit(params.entityId, 60),
    entityLabel: fit(params.entityLabel, 200),
    detail: fit(params.detail, 500, ""),
  };
  try {
    await AuditLog.create(event);
  } catch (err) {
    console.error(
      "[audit] FAILED to write audit event — record it manually:",
      JSON.stringify(event),
      err instanceof Error ? err.message : err
    );
  }
}
