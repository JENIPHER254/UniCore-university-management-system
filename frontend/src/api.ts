const API_BASE = "/api";

export class ApiClientError extends Error {
  status: number;
  details?: Record<string, string>;

  constructor(status: number, message: string, details?: Record<string, string>) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

let authToken: string | null = localStorage.getItem("unicore.token");

export function setToken(token: string | null): void {
  authToken = token;
  if (token) localStorage.setItem("unicore.token", token);
  else localStorage.removeItem("unicore.token");
}

export function getToken(): string | null {
  return authToken;
}

async function request<T>(method: string, path: string, json?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  if (authToken) headers.Authorization = `Bearer ${authToken}`;
  if (json !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(API_BASE + path, {
    method,
    headers,
    body: json === undefined ? undefined : JSON.stringify(json),
  });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = (data as { error?: { message?: string; details?: Record<string, string> } })?.error;
    if (res.status === 401 && authToken) {
      // Session expired — drop the stale token; AuthContext will redirect to login.
      setToken(null);
    }
    throw new ApiClientError(res.status, err?.message ?? `Request failed (${res.status})`, err?.details);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, json?: unknown) => request<T>("POST", path, json),
  put: <T>(path: string, json?: unknown) => request<T>("PUT", path, json),
  patch: <T>(path: string, json?: unknown) => request<T>("PATCH", path, json),
  /** CSV file download via browser navigation happens elsewhere; this returns raw text. */
  getText: async (path: string): Promise<string> => {
    const res = await fetch(API_BASE + path, {
      headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
    });
    if (!res.ok) {
      throw new ApiClientError(res.status, `Request failed (${res.status})`);
    }
    return res.text();
  },
};
