import { getDb } from "../db/index.js";
import { hashPassword, verifyPassword } from "../auth/password.js";
import { invalidateUserCache } from "../auth/middleware.js";
import { writeAudit } from "../lib/audit.js";
import { badRequest, conflict, notFound } from "../lib/errors.js";
import type { createUserSchema, updateUserSchema, changePasswordSchema } from "../validation/schemas.js";
import type { z } from "zod";

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export function listUsers() {
  const db = getDb();
  return db
    .prepare(
      `SELECT u.id, u.email, u.full_name AS fullName, u.role_code AS roleCode,
              r.name AS roleName, u.is_active AS isActive, u.created_at AS createdAt
       FROM users u JOIN roles r ON r.code = u.role_code
       ORDER BY u.id`
    )
    .all();
}

export function createUser(input: CreateUserInput, actorId: number) {
  const db = getDb();
  const exists = db.prepare("SELECT id FROM users WHERE email = ?").get(input.email);
  if (exists) throw conflict("A user with this email already exists");
  const result = db
    .prepare("INSERT INTO users (email, full_name, password_hash, role_code) VALUES (?, ?, ?, ?)")
    .run(input.email, input.fullName, hashPassword(input.password), input.roleCode);
  invalidateUserCache();
  writeAudit(db, {
    userId: actorId,
    action: "user.created",
    entityType: "user",
    entityId: result.lastInsertRowid,
    details: { email: input.email, roleCode: input.roleCode },
  });
  return db.prepare("SELECT id, email, full_name, role_code FROM users WHERE id = ?").get(result.lastInsertRowid);
}

export function updateUser(id: number, input: UpdateUserInput, actorId: number) {
  const db = getDb();
  const current = db.prepare("SELECT * FROM users WHERE id = ?").get(id);
  if (!current) throw notFound("User not found");
  const cur = current as { full_name: string; role_code: string; is_active: number };
  const fullName = input.fullName ?? cur.full_name;
  const roleCode = input.roleCode ?? cur.role_code;
  const isActive = input.isActive === undefined ? cur.is_active : input.isActive ? 1 : 0;
  let passwordHash: string | undefined;
  if (input.password) passwordHash = hashPassword(input.password);

  if (actorId === id && isActive === 0) {
    throw badRequest("You cannot deactivate your own account");
  }
  if (actorId === id && roleCode !== "administrator") {
    throw badRequest("You cannot remove your own administrator role");
  }

  const tx = db.transaction(() => {
    if (passwordHash) {
      db.prepare("UPDATE users SET full_name=?, role_code=?, is_active=?, password_hash=?, updated_at=? WHERE id=?")
        .run(fullName, roleCode, isActive, passwordHash, new Date().toISOString(), id);
    } else {
      db.prepare("UPDATE users SET full_name=?, role_code=?, is_active=?, updated_at=? WHERE id=?")
        .run(fullName, roleCode, isActive, new Date().toISOString(), id);
    }
    writeAudit(db, {
      userId: actorId,
      action: passwordHash ? "user.updated_with_reset" : "user.updated",
      entityType: "user",
      entityId: id,
      details: { fullName, roleCode, isActive: isActive === 1 },
    });
  });
  tx();
  invalidateUserCache(id);
  return db.prepare("SELECT id, email, full_name, role_code FROM users WHERE id = ?").get(id);
}

export function changePassword(id: number, input: ChangePasswordInput) {
  const db = getDb();
  const row = db.prepare("SELECT password_hash FROM users WHERE id = ?").get(id) as
    | { password_hash: string }
    | undefined;
  if (!row) throw notFound("User not found");
  if (!verifyPassword(input.currentPassword, row.password_hash)) {
    throw badRequest("Current password is incorrect");
  }
  db.prepare("UPDATE users SET password_hash=?, updated_at=? WHERE id=?").run(
    hashPassword(input.newPassword),
    new Date().toISOString(),
    id
  );
  invalidateUserCache(id);
  writeAudit(db, { userId: id, action: "password.changed", entityType: "user", entityId: id });
}
