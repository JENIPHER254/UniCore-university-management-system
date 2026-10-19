import { getDb, nowIso } from "../db/index.js";
import { writeAudit } from "../lib/audit.js";

export function getSettings(): Record<string, string> {
  const db = getDb();
  const rows = db.prepare("SELECT key, value FROM settings").all() as { key: string; value: string }[];
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

export function updateSettings(keys: Record<string, string>, actorId: number): Record<string, string> {
  const db = getDb();
  const allowed = new Set(["org_name", "currency", "currency_minor_units"]);
  const upsert = db.prepare("INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at");
  db.transaction(() => {
    for (const [key, value] of Object.entries(keys)) {
      if (!allowed.has(key)) continue;
      upsert.run(key, value, nowIso());
      writeAudit(db, { userId: actorId, action: "settings.updated", entityType: "setting", entityId: key, details: { value } });
    }
  })();
  return getSettings();
}
