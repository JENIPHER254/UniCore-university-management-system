import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { hashPassword } from "../auth/password.js";

export let baseUrl = "";
export let server: Server | null = null;

export async function startServer(): Promise<string> {
  // Imported dynamically so env vars (DATABASE_PATH) are set first by the test.
  const app = (await import("../app.js")).default;
  if (!server) {
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => resolve());
    });
  }
  const addr = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${addr.port}`;
  return baseUrl;
}

export async function closeServer(): Promise<void> {
  if (server) {
    await new Promise<void>((resolve) => {
      server?.closeIdleConnections?.();
      server?.close(() => resolve());
      // Never hangs the suite; if close stalls, force the callback in 2s.
      setTimeout(resolve, 2000).unref();
    });
    server = null;
  }
}

export interface ApiResponse {
  status: number;
  body: any;
}

export async function http(
  method: string,
  path: string,
  opts: { token?: string; json?: unknown } = {}
): Promise<ApiResponse> {
  const headers: Record<string, string> = {};
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  if (opts.json !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(baseUrl + path, {
    method,
    headers,
    body: opts.json === undefined ? undefined : JSON.stringify(opts.json),
  });
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null; // e.g. empty responses
  }
  return { status: res.status, body };
}

/** Directly creates a user in the test DB (bypassing the public API). */
export function makeDbUser(
  db: import("better-sqlite3").Database,
  email: string,
  fullName: string,
  roleCode: string,
  password: string,
  isActive = 1
): number {
  const res = db
    .prepare(
      "INSERT INTO users (email, full_name, password_hash, role_code, is_active) VALUES (?, ?, ?, ?, ?)"
    )
    .run(email, fullName, hashPassword(password), roleCode, isActive);
  return Number(res.lastInsertRowid);
}

export function login(email: string, password: string): Promise<ApiResponse> {
  return http("POST", "/api/auth/login", { json: { email, password } });
}

export function createUserRecord(
  db: import("better-sqlite3").Database,
  email: string,
  fullName: string,
  roleCode: string,
  password: string,
  isActive = 1
): number {
  return makeDbUser(db, email, fullName, roleCode, password, isActive);
}
