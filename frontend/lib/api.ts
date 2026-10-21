/**
 * API client for the UniCore backend (see /api/openapi.json for the full spec).
 * All UI data is fetched live from these endpoints with a bearer token.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

const TOKEN_KEY = 'unicore.token'
const USER_KEY = 'unicore.user'

export interface ApiUser {
  id: number
  email: string
  fullName: string
  roleCode: string
  roleName?: string
}

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

// ---- Token / user session helpers -------------------------------------------

export function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem(TOKEN_KEY)
}

export function setSession(token: string, user: ApiUser) {
  window.localStorage.setItem(TOKEN_KEY, token)
  window.localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function getStoredUser(): ApiUser | null {
  if (typeof window === 'undefined') return null
  const raw = window.localStorage.getItem(USER_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as ApiUser
  } catch {
    return null
  }
}

export function clearSession() {
  window.localStorage.removeItem(TOKEN_KEY)
  window.localStorage.removeItem(USER_KEY)
}

// ---- Fetch wrapper -----------------------------------------------------------

export async function api<T>(
  path: string,
  options: { method?: string; body?: unknown; skipToken?: boolean } = {}
): Promise<T> {
  const headers: Record<string, string> = {}
  if (options.body !== undefined) headers['Content-Type'] = 'application/json'
  const token = getToken()
  if (token && !options.skipToken) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${API_BASE}${path}`, {
    method: options.method || 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  })

  let payload: unknown = null
  if (res.status !== 204) {
    try {
      payload = await res.json()
    } catch {
      payload = null
    }
  }

  if (!res.ok) {
    const message =
      (payload as { error?: { message?: string } } | null)?.error?.message ||
      `Request failed (${res.status})`
    throw new ApiError(message, res.status)
  }
  return payload as T
}

/** If the session has expired, log the caller back out without breaking the page. */
export function isAuthError(err: unknown): err is ApiError {
  return err instanceof ApiError && err.status === 401
}

// ---- Formatting helpers shared by pages ---------------------------------------

/** "ZAR" / "$" style currency formatting driven by org settings. */
export function formatMoney(cents: number, currency = 'USD') {
  const symbolMap: Record<string, string> = {
    USD: '$', EUR: '€', GBP: '£', ZAR: 'R', NGN: '₦', KES: 'KSh', GHS: 'GH₵', CAD: 'C$', AUD: 'A$',
  }
  const symbol = symbolMap[currency] || `${currency} `
  return `${symbol}${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/** "2026-02-03" -> "3 Feb 2026" to match the existing table style. */
export function formatDate(iso: string | null | undefined) {
  if (!iso) return ''
  const d = new Date(`${String(iso).slice(0, 10)}T00:00:00Z`)
  if (Number.isNaN(d.getTime())) return String(iso)
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })
}
