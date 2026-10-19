import type { Request, RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config.js";
import { getDb } from "../db/index.js";
import { unauthorized, forbidden } from "../lib/errors.js";

export interface AuthUser {
  id: number;
  email: string;
  roleCode: string;
  fullName: string;
}

export interface AuthedRequest extends Request {
  user?: AuthUser;
}

export const ROLES = ["administrator", "finance_officer", "student_affairs_officer", "hr_officer"] as const;

/** Which roles can use which module (permissions enforced on the back end). */
export const MODULE_ROLES: Record<string, readonly string[]> = {
  dashboard: ROLES,
  students: ["administrator", "student_affairs_officer"],
  programmes: ["administrator", "student_affairs_officer"],
  finance: ["administrator", "finance_officer"],
  hr: ["administrator", "hr_officer"],
  users: ["administrator"],
  settings: ["administrator"],
  import: ROLES,
};

export function rolesForModule(module: string): readonly string[] {
  return MODULE_ROLES[module] ?? [];
}

const userCache = new Map<number, AuthUser | null>();

export function loadUser(userId: number): AuthUser | null {
  if (userCache.has(userId)) return userCache.get(userId)!;
  const db = getDb();
  const row = db
    .prepare(
      `SELECT u.id, u.email, u.full_name, u.role_code, u.is_active
       FROM users u WHERE u.id = ?`
    )
    .get(userId) as { id: number; email: string; full_name: string; role_code: string; is_active: number } | undefined;
  const user =
    row && row.is_active === 1
      ? { id: row.id, email: row.email, fullName: row.full_name, roleCode: row.role_code }
      : null;
  userCache.set(userId, user);
  return user;
}

export function invalidateUserCache(userId?: number): void {
  if (userId === undefined) userCache.clear();
  else userCache.delete(userId);
}

/** Requires a valid Bearer token; attaches the user to the request. */
export const authenticate: RequestHandler = (req, res, next) => {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
  if (!token) return next(unauthorized());
  try {
    const payload = jwt.verify(token, config.jwtSecret) as unknown as { sub: number };
    const user = loadUser(payload.sub);
    if (!user) return next(unauthorized("Your account is no longer active"));
    (req as AuthedRequest).user = user;
    next();
  } catch {
    next(unauthorized("Session expired — please sign in again"));
  }
};

/** Factory: allows only the listed roles (administrator always allowed). */
export function permitRole(...allowed: readonly string[]): RequestHandler {
  const allowedSet = new Set(allowed);
  return (req, res, next) => {
    const user = (req as AuthedRequest).user;
    if (!user) return next(unauthorized());
    if (user.roleCode !== "administrator" && !allowedSet.has(user.roleCode)) {
      return next(forbidden());
    }
    next();
  };
}

/** Factory: allows only roles permitted for the named module. */
export function permitModule(module: string): RequestHandler {
  return permitRole(...rolesForModule(module));
}
