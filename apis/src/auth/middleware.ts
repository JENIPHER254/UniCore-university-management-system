import type { Request, RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config.js";
import { getDb } from "../db/index.js";
import { unauthorized } from "../lib/errors.js";

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

/**
 * Which roles can use which module.
 * NOTE: role-based access restrictions have been removed — every module is
 * usable by any authenticated user (e.g. when exercising the API via Swagger).
 * This map is kept purely for reference.
 */
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
  fallbackUser = undefined; // default fallback identity may have changed
}

let fallbackUser: AuthUser | null | undefined;

/**
 * Default identity used when a request carries no (or an invalid) Bearer token.
 * Auth has been disabled: unauthenticated requests act as the first active
 * administrator, so Swagger/curl can be used with no Authorize header while
 * audit columns still reference a real user.
 */
function getFallbackUser(): AuthUser | null {
  if (fallbackUser !== undefined) return fallbackUser;
  const db = getDb();
  const row = db
    .prepare(
      `SELECT id, email, full_name, role_code
       FROM users
       WHERE is_active = 1
       ORDER BY CASE WHEN role_code = 'administrator' THEN 0 ELSE 1 END, id
       LIMIT 1`
    )
    .get() as { id: number; email: string; full_name: string; role_code: string } | undefined;
  fallbackUser = row ? { id: row.id, email: row.email, fullName: row.full_name, roleCode: row.role_code } : null;
  return fallbackUser;
}

/**
 * Authentication is disabled: a valid Bearer token is still honored, but
 * requests without one automatically act as the default (administrator) user
 * instead of failing with 401.
 */
export const authenticate: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
  if (token) {
    try {
      const payload = jwt.verify(token, config.jwtSecret) as unknown as { sub: number };
      const user = loadUser(payload.sub);
      if (user) {
        (req as AuthedRequest).user = user;
        next();
        return;
      }
    } catch {
      // invalid/expired token — fall back to the default identity below
    }
  }
  const fallback = getFallbackUser();
  if (!fallback) return next(unauthorized("No users exist yet — seed the database first"));
  (req as AuthedRequest).user = fallback;
  next();
};

/**
 * Factory: no role restriction — any authenticated user may use the module.
 * (Kept as a hook so module restrictions can be restored in one place.)
 */
export function permitModule(_module: string): RequestHandler {
  return (req, _res, next) => {
    const user = (req as AuthedRequest).user;
    if (!user) return next(unauthorized());
    next();
  };
}
