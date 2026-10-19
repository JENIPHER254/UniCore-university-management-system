import { getDb, nowIso, withTransaction } from "../db/index.js";
import { nextNumber } from "../lib/numbers.js";
import { writeAudit } from "../lib/audit.js";
import { conflict, notFound } from "../lib/errors.js";
import type { departmentSchema, programmeSchema } from "../validation/schemas.js";
import type { z } from "zod";

export type ProgrammeInput = z.infer<typeof programmeSchema>;
export type DepartmentInput = z.infer<typeof departmentSchema>;

// ---- Programmes -------------------------------------------------------------
export function listProgrammes(includeInactive = false) {
  const db = getDb();
  return db
    .prepare(
      `SELECT id, code, name, level, is_active AS isActive, created_at AS createdAt
       FROM programmes ${includeInactive ? "" : "WHERE is_active = 1"} ORDER BY name`
    )
    .all();
}

export function createProgramme(input: ProgrammeInput, actorId: number, manualCode?: string) {
  const db = getDb();
  return withTransaction(db, () => {
    const code = manualCode ?? nextNumber(db, "programme_code");
    const dup = db.prepare("SELECT id FROM programmes WHERE code = ?").get(code);
    if (dup) throw conflict("Programme code already exists", { code: "Already in use" });
    const res = db
      .prepare("INSERT INTO programmes (code, name, level, is_active) VALUES (?, ?, ?, ?)")
      .run(code, input.name, input.level, input.isActive ? 1 : 0);
    writeAudit(db, {
      userId: actorId,
      action: "programme.created",
      entityType: "programme",
      entityId: res.lastInsertRowid,
      details: { code, name: input.name },
    });
    return db.prepare("SELECT * FROM programmes WHERE id = ?").get(res.lastInsertRowid);
  });
}

export function updateProgramme(id: number, input: ProgrammeInput, actorId: number) {
  const db = getDb();
  const current = db.prepare("SELECT * FROM programmes WHERE id = ?").get(id) as
    | { id: number; code: string }
    | undefined;
  if (!current) throw notFound("Programme not found");
  db.prepare("UPDATE programmes SET name=?, level=?, is_active=?, updated_at=? WHERE id=?").run(
    input.name,
    input.level,
    input.isActive ? 1 : 0,
    nowIso(),
    id
  );
  writeAudit(db, {
    userId: actorId,
    action: "programme.updated",
    entityType: "programme",
    entityId: id,
    details: { name: input.name, isActive: input.isActive },
  });
  return db.prepare("SELECT * FROM programmes WHERE id = ?").get(id);
}

// ---- Departments ------------------------------------------------------------
export function listDepartments(includeInactive = false) {
  const db = getDb();
  return db
    .prepare(
      `SELECT id, code, name, is_active AS isActive, created_at AS createdAt
       FROM departments ${includeInactive ? "" : "WHERE is_active = 1"} ORDER BY name`
    )
    .all();
}

export function createDepartment(input: DepartmentInput, actorId: number, manualCode?: string) {
  const db = getDb();
  return withTransaction(db, () => {
    const code = manualCode ?? nextNumber(db, "department_code");
    const dup = db.prepare("SELECT id FROM departments WHERE code = ?").get(code);
    if (dup) throw conflict("Department code already exists", { code: "Already in use" });
    const res = db
      .prepare("INSERT INTO departments (code, name, is_active) VALUES (?, ?, ?)")
      .run(code, input.name, input.isActive ? 1 : 0);
    writeAudit(db, {
      userId: actorId,
      action: "department.created",
      entityType: "department",
      entityId: res.lastInsertRowid,
      details: { code, name: input.name },
    });
    return db.prepare("SELECT * FROM departments WHERE id = ?").get(res.lastInsertRowid);
  });
}

export function updateDepartment(id: number, input: DepartmentInput, actorId: number) {
  const db = getDb();
  const current = db.prepare("SELECT * FROM departments WHERE id = ?").get(id) as
    | { id: number; code: string }
    | undefined;
  if (!current) throw notFound("Department not found");
  db.prepare("UPDATE departments SET name=?, is_active=?, updated_at=? WHERE id=?").run(
    input.name,
    input.isActive ? 1 : 0,
    nowIso(),
    id
  );
  writeAudit(db, {
    userId: actorId,
    action: "department.updated",
    entityType: "department",
    entityId: id,
    details: { name: input.name, isActive: input.isActive },
  });
  return db.prepare("SELECT * FROM departments WHERE id = ?").get(id);
}
