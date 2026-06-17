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

export function logAudit(params: AuditParams): void {
  // Fire-and-forget — never await so it never slows down the response
  AuditLog.create({
    userName: params.userName,
    userRole: params.userRole,
    action: params.action,
    entity: params.entity,
    entityId: params.entityId,
    entityLabel: params.entityLabel,
    detail: params.detail ?? "",
  }).catch(() => {/* silently ignore audit failures */});
}
