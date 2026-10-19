import type { Db } from "../db/index.js";

export function writeAudit(
  db: Db,
  input: {
    userId: number | null;
    action: string;
    entityType: string;
    entityId?: string | number | bigint;
    details?: Record<string, unknown>;
  }
): void {
  db.prepare(
    "INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?)"
  ).run(
    input.userId,
    input.action,
    input.entityType,
    String(input.entityId ?? ""),
    JSON.stringify(input.details ?? {})
  );
}
