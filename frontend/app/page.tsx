'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Activity, Bell, BookOpen, BriefcaseBusiness, ChevronDown, CircleDollarSign, ClipboardList, Download, Edit3, FileText, GraduationCap, LayoutDashboard, LogOut, Menu, MoreHorizontal, PanelLeftClose, PanelLeftOpen, Plus, Search, Settings, ShieldCheck, Upload, Users, WalletCards, X } from 'lucide-react'
import { api, clearSession, formatDate, formatMoney, getToken, getStoredUser, isAuthError, setSession, type ApiUser } from '@/lib/api'

type Row = Record<string, string>
const nav = [['Dashboard', LayoutDashboard], ['Students', GraduationCap], ['Programmes', BookOpen], ['Finance', CircleDollarSign], ['Human resources', BriefcaseBusiness], ['Import / export', ClipboardList]] as const
const admin = [['User management', ShieldCheck], ['Settings', Settings]] as const

/** Backend role codes -> display labels (see apis/src/auth/middleware.ts). */
const ROLE_LABELS: Record<string, string> = {
  administrator: 'Administrator',
  finance_officer: 'Finance Officer',
  student_affairs_officer: 'Student Affairs Officer',
  hr_officer: 'HR Officer',
}

const METHOD_LABELS: Record<string, string> = {
  cash: 'Cash', bank_transfer: 'Bank transfer', card: 'Card', mobile_money: 'Mobile money', cheque: 'Cheque',
}

function Logo({ compact = false }: { compact?: boolean }) { return <div className="flex items-center gap-3"><div className="grid size-9 place-items-center rounded-xl bg-[#102d55] text-sm font-bold text-white">U</div>{!compact && <div><p className="text-[15px] font-bold text-[#162a43]">UniCore</p><p className="text-[10px] uppercase tracking-[.16em] text-slate-400">University ERP</p></div>}</div> }

function LoginPage({ onLogin }: { onLogin: (user: ApiUser) => void }) {
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false)
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!email || !password) { setError('Enter your email and password to continue.'); return }
    setBusy(true); setError('')
    try {
      const res = await api<{ token: string; user: ApiUser }>('/api/auth/login', { method: 'POST', body: { email, password }, skipToken: true })
      const user = { ...res.user, roleName: ROLE_LABELS[res.user.roleCode] || res.user.roleName }
      setSession(res.token, user)
      onLogin(user)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed. Please try again.')
    } finally { setBusy(false) }
  }
  return <main className="grid min-h-screen place-items-center bg-[#f7f9fc] px-4"><section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-xl"><Logo /><div className="mt-10"><h1 className="text-2xl font-bold text-[#172b45]">Welcome back</h1><p className="mt-2 text-sm text-slate-500">Sign in to your UniCore dashboard.</p></div><form onSubmit={submit} className="mt-7 grid gap-4"><label className="text-xs font-semibold text-slate-600">Email<input type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} className="mt-1.5 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" placeholder="you@unicore.edu" /></label><label className="text-xs font-semibold text-slate-600">Password<input type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} className="mt-1.5 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" placeholder="Enter your password" /></label>{error && <p role="alert" className="text-xs text-red-600">{error}</p>}<button type="submit" disabled={busy} className="mt-2 h-11 rounded-lg bg-[#1e5a9d] text-sm font-semibold text-white disabled:opacity-60">{busy ? 'Signing in…' : 'Sign in'}</button></form><p className="mt-4 text-center text-xs text-slate-400">Use the credentials provided by your administrator.</p></section></main>
}

function RegisterPage({ onBack, onRegistered }: { onBack: () => void; onRegistered: () => void }) {
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' }); const [error, setError] = useState('')
  const submit = (e: FormEvent) => { e.preventDefault(); if (!form.name || !form.email || form.password.length < 8) { setError('Complete all fields. Password must be at least 8 characters.'); return } if (form.password !== form.confirm) { setError('Passwords do not match.'); return } onRegistered() }
  const update = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [key]: e.target.value })
  return <main className="grid min-h-screen place-items-center bg-[#f7f9fc] px-4"><section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-xl"><Logo /><div className="mt-10"><h1 className="text-2xl font-bold text-[#172b45]">Create account</h1><p className="mt-2 text-sm text-slate-500">Register for access to UniCore.</p></div><form onSubmit={submit} className="mt-7 grid gap-4"><label className="text-xs font-semibold text-slate-600">Full name<input required value={form.name} onChange={update('name')} className="mt-1.5 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal" placeholder="Your full name" /></label><label className="text-xs font-semibold text-slate-600">Email<input required type="email" value={form.email} onChange={update('email')} className="mt-1.5 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal" placeholder="you@unicore.edu" /></label><label className="text-xs font-semibold text-slate-600">Password<input required type="password" minLength={8} value={form.password} onChange={update('password')} className="mt-1.5 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal" placeholder="Minimum 8 characters" /></label><label className="text-xs font-semibold text-slate-600">Confirm password<input required type="password" value={form.confirm} onChange={update('confirm')} className="mt-1.5 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal" placeholder="Repeat your password" /></label>{error && <p role="alert" className="text-xs text-red-600">{error}</p>}<button type="submit" className="h-11 rounded-lg bg-[#1e5a9d] text-sm font-semibold text-white">Register</button></form><button onClick={onBack} className="mt-6 w-full text-center text-xs font-semibold text-[#1e5a9d]">Already have an account? Sign in</button></section></main>
}

function Stat({ label, value, icon: Icon, tone }: { label: string; value: string; icon: any; tone: string }) { return <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex justify-between"><div><p className="text-xs text-slate-500">{label}</p><p className="mt-2 text-2xl font-bold text-[#172b45]">{value}</p></div><div className={`grid size-10 place-items-center rounded-xl ${tone}`}><Icon className="size-[18px]" /></div></div><p className="mt-4 text-xs text-emerald-600">+8.4% <span className="text-slate-400">vs last month</span></p></div> }

type SelectOption = { value: string; label: string }

function Modal({ title, fields, selects = {}, onClose, onSubmit }: { title: string; fields: string[]; selects?: Record<string, SelectOption[]>; onClose: () => void; onSubmit: (r: Row) => Promise<void> | void }) {
  const [form, setForm] = useState<Row>({}); const [error, setError] = useState(''); const [busy, setBusy] = useState(false)
  const accountType = title.toLowerCase(); const isUser = accountType.includes('user'); const isAccountHolder = isUser || accountType.includes('student') || accountType.includes('employee')
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setError('')
    try { await onSubmit(form); onClose() } catch (err) { setError(err instanceof Error ? err.message : 'Could not save the record.') } finally { setBusy(false) }
  }
  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/35 p-4"><div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl"><div className="flex items-center justify-between border-b border-slate-100 p-5"><div><h2 className="font-bold text-[#172b45]">{title}</h2><p className="mt-1 text-xs text-slate-400">Complete the required details below.</p></div><button onClick={onClose} aria-label="Close"><X className="size-5 text-slate-400" /></button></div><form onSubmit={submit} className="grid gap-4 p-5 sm:grid-cols-2">{fields.map(f => <label key={f} className="text-xs font-semibold capitalize text-slate-600">{f}{selects[f] ? <select required className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" value={form[f] || ''} onChange={e => setForm({ ...form, [f]: e.target.value })}><option value="">Select {f}</option>{selects[f].map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select> : <input required type={f === 'password' ? 'password' : 'text'} minLength={f === 'password' ? 8 : undefined} placeholder={f === 'password' ? 'Minimum 8 characters' : undefined} className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" value={form[f] || ''} onChange={e => setForm({ ...form, [f]: e.target.value })} />}</label>)}{isAccountHolder && <label className="text-xs font-semibold capitalize text-slate-600">Password<input required type="password" minLength={8} placeholder="Minimum 8 characters" className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" value={form.password || ''} onChange={e => setForm({ ...form, password: e.target.value })} /></label>}{error && <p role="alert" className="text-xs text-red-600 sm:col-span-2">{error}</p>}<div className="flex justify-end gap-2 border-t border-slate-100 p-5 sm:col-span-2"><button onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600">Cancel</button><button type="submit" disabled={busy} className="rounded-lg bg-[#1e5a9d] px-4 py-2 text-xs font-semibold text-white disabled:opacity-60">{busy ? 'Saving…' : 'Save record'}</button></div></form></div></div>
}

// ---- Shared data-loading helpers -------------------------------------------------

type ListResponse<T> = { data: T[]; page: number; pageSize: number; total: number; totalPages: number }

async function fetchList<T>(path: string, params: Record<string, string> = {}): Promise<ListResponse<T>> {
  const qs = new URLSearchParams(params).toString()
  return api<ListResponse<T>>(`${path}${qs ? `?${qs}` : ''}`)
}

function useApiData<T>(loader: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const run = useCallback(() => {
    setLoading(true); setError('')
    loader()
      .then(res => setData(res))
      .catch(err => {
        if (isAuthError(err)) { clearSession(); setError('Your session has expired — please sign in again.') }
        else setError(err instanceof Error ? err.message : 'Failed to load data')
      })
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  useEffect(() => { run() }, [run])
  return { data, loading, error, reload: run }
}

/** Data reference kept alongside displayed rows so actions can hit the API by id. */
type RowRef = { id: number; active: boolean; extra?: Record<string, string> }

function TablePage({ title, description, kind, refreshKey, onAdd, notify }: { title: string; description: string; kind: 'student' | 'programme' | 'employee' | 'user'; refreshKey: number; onAdd: () => void; notify: (s: string) => void }) {
  const [q, setQ] = useState(''); const [role, setRole] = useState(''); const [page, setPage] = useState(1); const pageSize = 5
  const [refs, setRefs] = useState<RowRef[]>([])

  const { data: items, loading, error, reload } = useApiData<Row[]>(async () => {
    let rows: Row[] = []
    if (kind === 'student') {
      const res = await fetchList<{ id: number; studentNumber: string; firstName: string; lastName: string; email: string; phone: string; programmeName: string | null; admissionDate: string; status: string }>('/api/students', { pageSize: '100' })
      rows = res.data.map(s => ({ number: s.studentNumber, name: `${s.firstName} ${s.lastName}`, email: s.email, phone: s.phone || '—', programme: s.programmeName || '—', date: formatDate(s.admissionDate), status: s.status === 'active' ? 'Active' : 'Inactive' }))
      setRefs(res.data.map(s => ({ id: s.id, active: s.status === 'active' })))
    } else if (kind === 'programme') {
      const [res, students] = await Promise.all([
        api<{ id: number; code: string; name: string; level: string; isActive: number }[]>('/api/programmes?all=1'),
        fetchList<{ programmeId: number | null }>('/api/students', { pageSize: '100' }).catch(() => ({ data: [] as { programmeId: number | null }[] })),
      ])
      const counts = new Map<number, number>()
      for (const s of students.data) if (s.programmeId) counts.set(s.programmeId, (counts.get(s.programmeId) || 0) + 1)
      rows = res.map(p => ({ code: p.code, name: p.name, description: p.level || '—', duration: p.level || '—', status: p.isActive ? 'Active' : 'Inactive', students: String(counts.get(p.id) || 0) }))
      setRefs(res.map(p => ({ id: p.id, active: !!p.isActive, extra: { code: p.code, name: p.name, level: p.level || '' } })))
    } else if (kind === 'employee') {
      const res = await fetchList<{ id: number; employeeNumber: string; firstName: string; lastName: string; email: string; phone: string; departmentName: string | null; jobTitle: string; employmentDate: string; status: string }>('/api/employees', { pageSize: '100' })
      rows = res.data.map(e => ({ number: e.employeeNumber, name: `${e.firstName} ${e.lastName}`, email: e.email, phone: e.phone || '—', department: e.departmentName || '—', job: e.jobTitle || '—', date: formatDate(e.employmentDate), status: e.status === 'active' ? 'Active' : 'Inactive' }))
      setRefs(res.data.map(e => ({ id: e.id, active: e.status === 'active' })))
    } else {
      const users = await api<{ id: number; fullName: string; email: string; roleName: string; isActive: number; createdAt: string }[]>('/api/users')
      rows = users.map(u => ({ name: u.fullName, email: u.email, role: u.roleName, date: formatDate(u.createdAt), status: u.isActive ? 'Active' : 'Inactive' }))
      setRefs(users.map(u => ({ id: u.id, active: !!u.isActive })))
    }
    return rows
  }, [kind, refreshKey])

  const filtered = useMemo(() => (items || []).filter(r => Object.values(r).join(' ').toLowerCase().includes(q.toLowerCase()) && (!role || r.role === role)), [items, q, role])
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize)); const visible = filtered.slice((page - 1) * pageSize, page * pageSize)
  const columns = Object.keys(items?.[0] || {})

  const toggleStatus = async (index: number) => {
    const ref = refs[(page - 1) * pageSize + index]
    const row = visible[index]
    if (!ref || !row) return
    const next = !ref.active
    try {
      if (kind === 'student') await api(`/api/students/${ref.id}/status`, { method: 'PATCH', body: { status: next ? 'active' : 'inactive' } })
      else if (kind === 'employee') await api(`/api/employees/${ref.id}/status`, { method: 'PATCH', body: { status: next ? 'active' : 'inactive' } })
      else if (kind === 'programme') await api(`/api/programmes/${ref.id}`, { method: 'PUT', body: { code: ref.extra?.code || row.code, name: ref.extra?.name || row.name, level: ref.extra?.level || '', isActive: next } })
      else await api(`/api/users/${ref.id}`, { method: 'PUT', body: { isActive: next } })
      notify(`${row.name || row.code} is now ${next ? 'active' : 'inactive'} — updated successfully`)
      reload()
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not update the record')
    }
  }

  return <><div className="mb-7 flex flex-wrap items-end justify-between gap-4"><div><p className="mb-1 text-xs font-semibold uppercase tracking-[.13em] text-[#2e73b8]">Workspace</p><h1 className="text-[26px] font-bold text-[#172b45]">{title}</h1><p className="mt-1 text-sm text-slate-500">{description}</p></div><button onClick={onAdd} className="inline-flex items-center gap-2 rounded-xl bg-[#1e5a9d] px-4 py-2.5 text-xs font-semibold text-white"><Plus className="size-4" />Add {kind}</button></div><div className="rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4"><div className="flex flex-wrap items-center gap-2"><div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><input aria-label={`Search ${title}`} value={q} onChange={e => { setQ(e.target.value); setPage(1) }} placeholder={`Search ${title.toLowerCase()}...`} className="h-10 w-64 rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-xs outline-none focus:border-blue-400" /></div><select aria-label="Filter users by role" value={role} onChange={e => { setRole(e.target.value); setPage(1) }} className="h-10 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs text-slate-600"><option value="">All roles</option>{arrayUnique((items || []).map(r => r.role)).filter(Boolean).map(r => <option key={r} value={r}>{r}</option>)}</select></div><span className="text-xs text-slate-400">{filtered.length} records</span></div><div className="overflow-x-auto"><table className="w-full min-w-[760px]"><thead><tr className="bg-slate-50/70">{columns.map(c => <th key={c} className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">{c}</th>)}<th className="px-5 py-3 text-right text-[10px] font-bold uppercase text-slate-400">Actions</th></tr></thead><tbody>{visible.map((r, i) => <tr key={i} className="border-t border-slate-100 hover:bg-slate-50/60">{columns.map(c => <td key={c} className="px-5 py-3.5 text-xs text-slate-600">{c === 'status' ? <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${r[c] === 'Active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{r[c]}</span> : r[c]}</td>)}<td className="px-5 py-3 text-right"><button onClick={() => toggleStatus(i)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100" title="Toggle active status"><MoreHorizontal className="size-4" /></button></td></tr>)}</tbody></table>{loading && <div className="p-12 text-center text-sm text-slate-500">Loading records…</div>}{!loading && !!error && <div className="p-12 text-center text-sm text-slate-500"><span className="text-red-600">{error}</span></div>}{!loading && !error && !filtered.length && <div className="p-12 text-center text-sm text-slate-500">No records found. Try a different search or add a new record.</div>}</div><div className="flex items-center justify-between border-t border-slate-100 p-4 text-xs text-slate-400"><span>Showing {filtered.length} of {(items || []).length} records</span><span>Page {page} of {pageCount}</span></div></div></>
}

function arrayUnique(values: string[]) { return Array.from(new Set(values)) }

interface DashboardTotals { activeStudents: number; totalStudents: number; activeEmployees: number; paymentsReceivedCents: number; outstandingCents: number }
interface DashboardRecentStudent { id: number; studentNumber: string; firstName: string; lastName: string; programmeName: string | null; status: string }
interface DashboardData { totals: DashboardTotals; recentStudents: DashboardRecentStudent[]; recentPayments: unknown[] }

function Dashboard({ go, onRegister, role, currency, refreshKey }: { go: (s: string) => void; onRegister: () => void; role: string; currency: string; refreshKey: number }) {
  const { data: dash, loading, error } = useApiData<DashboardData>(() => api<DashboardData>('/api/dashboard/'), [refreshKey])
  const { data: programmes } = useApiData<{ id: number; isActive: number }[]>(() => api<{ id: number; isActive: number }[]>('/api/programmes?all=1').catch(() => []), [])
  const { data: paymentsPage } = useApiData<ListResponse<{ amountCents: number; paymentDate: string }>>(() => fetchList<{ amountCents: number; paymentDate: string }>('/api/finance/payments', { pageSize: '100' }).catch(() => ({ data: [] as { amountCents: number; paymentDate: string }[], page: 0, pageSize: 0, total: 0, totalPages: 0 })), [refreshKey])

  const money = (cents: number) => formatMoney(cents, currency)

  // Monthly payment sums feed the fee-collection bar chart (live data).
  const { bars, delta } = useMemo(() => {
    if (!paymentsPage?.data?.length) return { bars: null, delta: null }
    const monthly = new Map<string, number>()
    for (const p of paymentsPage.data) {
      const key = String(p.paymentDate).slice(0, 7)
      monthly.set(key, (monthly.get(key) || 0) + p.amountCents)
    }
    const keys = [...monthly.keys()].sort()
    const series = keys.slice(-12).map(k => monthly.get(k) || 0)
    if (!series.length) return { bars: null, delta: null }
    const max = Math.max(...series)
    const prev = series.length >= 2 ? series[series.length - 2] : 0
    const last = series[series.length - 1]
    return {
      bars: series.map(v => Math.max(8, Math.round((v / max) * 100))),
      delta: prev > 0 ? `+${(((last - prev) / prev) * 100).toFixed(1)}%` : 'new',
    }
  }, [paymentsPage])

  const recent = dash?.recentStudents || []; const totals = dash?.totals

  return <><div className="mb-7 flex flex-wrap items-end justify-between gap-4"><div><p className="mb-1 text-xs font-semibold uppercase tracking-[.13em] text-[#2e73b8]">Overview · {role}</p><h1 className="text-[26px] font-bold">{role} dashboard</h1><p className="mt-1 text-sm text-slate-500">Here&apos;s what&apos;s happening across your university today.</p></div><button onClick={onRegister} className="inline-flex items-center gap-2 rounded-xl bg-[#1e5a9d] px-4 py-2.5 text-xs font-semibold text-white"><Plus className="size-4" />Register student</button></div><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5"><Stat label="Total students" value={loading || error ? '—' : String(totals?.totalStudents ?? 0)} icon={GraduationCap} tone="bg-[#eaf1fb] text-[#2871b9]" /><Stat label="Programmes" value={error ? '—' : String(programmes?.length || 0)} icon={BookOpen} tone="bg-violet-50 text-violet-600" /><Stat label="Employees" value={loading || error ? '—' : String(totals?.activeEmployees ?? 0)} icon={Users} tone="bg-emerald-50 text-emerald-600" /><Stat label="Payments received" value={loading || error ? '—' : money(totals?.paymentsReceivedCents ?? 0)} icon={WalletCards} tone="bg-amber-50 text-amber-600" /><Stat label="Outstanding fees" value={loading || error ? '—' : money(totals?.outstandingCents ?? 0)} icon={CircleDollarSign} tone="bg-orange-50 text-orange-600" /></div>{error && <p role="alert" className="mt-4 text-xs text-red-600">{error}</p>}<div className="mt-7 grid gap-6 xl:grid-cols-2"><section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><div><h2 className="text-sm font-bold">Recent student registrations</h2><p className="mt-1 text-xs text-slate-400">Latest additions to the system</p></div><button onClick={() => go('Students')} className="text-xs font-semibold text-blue-600">View all</button></div><div className="mt-4 grid gap-2">{loading && <p className="p-3 text-xs text-slate-400">Loading recent registrations…</p>}{!loading && !recent.length && <p className="p-3 text-xs text-slate-400">No student registrations yet.</p>}{recent.map(s => <div key={s.id} className="flex items-center justify-between rounded-xl bg-slate-50 p-3"><div><p className="text-xs font-semibold">{s.firstName} {s.lastName}</p><p className="mt-1 text-[10px] text-slate-400">{s.studentNumber} · {s.programmeName || 'No programme'}</p></div><span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${s.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{s.status === 'active' ? 'Active' : 'Inactive'}</span></div>)}</div></section><section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><div><h2 className="text-sm font-bold">Fee collection</h2><p className="mt-1 text-xs text-slate-400">Payments received this year</p></div><button onClick={() => go('Finance')} className="text-xs font-semibold text-blue-600">View finance</button></div><div className="mt-5 flex items-end gap-2"><span className="text-2xl font-bold">{money(totals?.paymentsReceivedCents ?? 0)}</span>{delta && <span className="text-xs font-semibold text-emerald-600">{delta}</span>}</div><div className="mt-6 flex h-32 items-end gap-2 border-b border-slate-100">{(bars || Array(12).fill(6)).map((h, i) => <div key={i} className="flex-1 rounded-t-md bg-[#cfe0f3]" style={{ height: `${h}%` }} />)}</div></section></div></>
}

interface ClientPayment { id: number; paymentNumber: string; studentNumber: string | null; firstName: string | null; lastName: string | null; amountCents: number; method: string; reference: string; paymentDate: string; isReversed: number }

function Finance({ notify, currency, refreshKey }: { notify: (s: string) => void; currency: string; refreshKey: number }) {
  const [page, setPage] = useState(1); const pageSize = 10
  const [modal, setModal] = useState(false); const [dataVersion, setDataVersion] = useState(0)

  const { data: dash } = useApiData<DashboardData>(() => api<DashboardData>('/api/dashboard/'), [refreshKey, dataVersion])
  const { data: payments, loading, error } = useApiData<ListResponse<ClientPayment>>(() => fetchList<ClientPayment>('/api/finance/payments', { pageSize: '100' }), [dataVersion])
  const { data: students } = useApiData<{ id: number; studentNumber: string; firstName: string; lastName: string }[]>(() => fetchList<{ id: number; studentNumber: string; firstName: string; lastName: string }>('/api/students', { pageSize: '100', status: 'active' }).then(r => r.data).catch(() => []), [])

  const rows = useMemo(() => (payments?.data || []).map(p => [
    p.paymentNumber, `${p.firstName || ''} ${p.lastName || ''}`.trim() || p.studentNumber || '—',
    METHOD_LABELS[p.method] || p.method, formatMoney(p.amountCents, currency), formatDate(p.paymentDate),
    p.isReversed ? 'Reversed' : 'Valid',
  ]), [payments, currency])
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize)); const visible = rows.slice((page - 1) * pageSize, page * pageSize)

  const totals = dash?.totals; const money = (cents: number) => formatMoney(cents, currency)
  const methodOptions = Object.entries(METHOD_LABELS).map(([value, label]) => ({ value, label }))
  const studentOptions = (students || []).map(s => ({ value: String(s.id), label: `${s.studentNumber} — ${s.firstName} ${s.lastName}` }))

  const savePayment = async (form: Row) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.date || '')) throw new Error('Use the date format YYYY-MM-DD')
    if (!form.student) throw new Error('Select a student')
    await api('/api/finance/payments', { method: 'POST', body: { studentId: Number(form.student), amount: form.amount, method: form.method || 'cash', reference: form.reference || '', paymentDate: form.date } })
    notify('Payment recorded successfully'); setDataVersion(v => v + 1)
  }

  return <><div className="mb-7"><p className="mb-1 text-xs font-semibold uppercase tracking-[.13em] text-[#2e73b8]">Workspace</p><h1 className="text-[26px] font-bold">Finance</h1><p className="mt-1 text-sm text-slate-500">Track charges, payments, balances, and transaction history.</p></div><div className="grid gap-4 md:grid-cols-3"><Stat label="Fees charged" value={totals ? money((totals.paymentsReceivedCents || 0) + (totals.outstandingCents || 0)) : '—'} icon={FileText} tone="bg-blue-50 text-blue-600" /><Stat label="Payments received" value={totals ? money(totals.paymentsReceivedCents || 0) : '—'} icon={WalletCards} tone="bg-emerald-50 text-emerald-600" /><Stat label="Outstanding balance" value={totals ? money(totals.outstandingCents || 0) : '—'} icon={CircleDollarSign} tone="bg-amber-50 text-amber-600" /></div><div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><h2 className="text-sm font-bold">Payment transactions</h2><button onClick={() => setModal(true)} className="rounded-lg bg-[#1e5a9d] px-3 py-2 text-xs font-semibold text-white"><Plus className="mr-1 inline size-3" />Record payment</button></div><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[650px]"><thead><tr className="bg-slate-50 text-left text-[10px] uppercase text-slate-400"><th className="p-3">Reference</th><th className="p-3">Student</th><th className="p-3">Method</th><th className="p-3">Amount</th><th className="p-3">Date</th><th className="p-3">Status</th></tr></thead><tbody>{visible.map((r, i) => <tr key={i} className="border-t border-slate-100 text-xs text-slate-600">{r.map((x, j) => <td className="p-3" key={j}>{j === 5 ? <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${x === 'Valid' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{x}</span> : x}</td>)}</tr>)}</tbody></table>{loading && <div className="p-12 text-center text-sm text-slate-500">Loading payments…</div>}{!loading && !!error && <div className="p-12 text-center text-sm text-slate-500"><span className="text-red-600">{error}</span></div>}{!loading && !error && !visible.length && <div className="p-12 text-center text-sm text-slate-500">No payment transactions found. Record a payment to get started.</div>}</div><div className="flex items-center justify-between border-t border-slate-100 p-4"><span className="text-xs text-slate-400">Page {page} of {pageCount}</span><div className="flex gap-2"><button disabled={page === 1} onClick={() => setPage(p => Math.max(1, p - 1))} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs disabled:opacity-40">Previous</button><button disabled={page === pageCount} onClick={() => setPage(p => Math.min(pageCount, p + 1))} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs disabled:opacity-40">Next</button></div></div></div>{modal && <Modal title="Record payment" fields={['student', 'amount', 'method', 'reference', 'date']} selects={studentOptions.length ? { student: studentOptions, method: methodOptions } : { method: methodOptions }} onClose={() => setModal(false)} onSubmit={savePayment} />}</>
}

function ImportExport({ notify, onImported }: { notify: (s: string) => void; onImported: () => void }) {
  const fileInput = useRef<HTMLInputElement | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)

  const exportCsv = async () => {
    setBusy(true)
    try {
      const token = getToken()
      const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'
      const res = await fetch(`${base}/api/export/students.csv`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      if (!res.ok) throw new Error(`Export failed (${res.status})`)
      const blob = new Blob([await res.text()], { type: 'text/csv; charset=utf-8' })
      const url = URL.createObjectURL(blob); const a = document.createElement('a')
      a.href = url; a.download = 'students.csv'; a.click(); URL.revokeObjectURL(url)
      notify('Export prepared successfully')
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Export failed')
    } finally { setBusy(false) }
  }

  const downloadTemplate = async () => {
    setBusy(true)
    try {
      const spec = await api<{ headers: string[]; rows: string[][] }>('/api/export/students.json')
      const blob = new Blob([`${spec.headers.join(',')}\n`], { type: 'text/csv; charset=utf-8' })
      const url = URL.createObjectURL(blob); const a = document.createElement('a')
      a.href = url; a.download = 'students-template.csv'; a.click(); URL.revokeObjectURL(url)
      notify('CSV template downloaded')
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Template download failed')
    } finally { setBusy(false) }
  }

  /** Validates with a dry run first, then imports for real (server-side transaction). */
  const importCsv = async () => {
    if (!file) return
    setBusy(true)
    try {
      const csv = await file.text()
      await api('/api/import/students', { method: 'POST', body: { csv, dryRun: true } })
      await api('/api/import/students', { method: 'POST', body: { csv } })
      notify('Import completed successfully')
      setFile(null)
      if (fileInput.current) fileInput.current.value = ''
      onImported()
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Import failed')
    } finally { setBusy(false) }
  }

  return <><div className="mb-7"><p className="mb-1 text-xs font-semibold uppercase tracking-[.13em] text-[#2e73b8]">Workspace</p><h1 className="text-[26px] font-bold">Import / export</h1><p className="mt-1 text-sm text-slate-500">Move validated university data in and out of UniCore.</p></div><input ref={fileInput} type="file" accept=".csv,text/csv" className="hidden" onChange={e => { setFile(e.target.files?.[0] || null) }} /><div className="grid gap-6 lg:grid-cols-2">{[['Import data', Upload, 'Choose a CSV file, validate rows, and preview changes before importing.'], ['Export data', Download, 'Download current database records as a valid CSV file.']].map(([title, Icon, desc]) => <section key={title as string} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><div className="grid size-11 place-items-center rounded-xl bg-blue-50 text-blue-600"><Icon className="size-5" /></div><h2 className="mt-4 font-bold">{title as string}</h2><p className="mt-2 text-sm text-slate-500">{title === 'Import data' && file ? `Selected: ${file.name}` : (desc as string)}</p><div className="mt-5 flex gap-2"><button disabled={busy} onClick={() => { if (title === 'Import data') { if (file) void importCsv(); else fileInput.current?.click() } else void exportCsv() }} className="rounded-lg bg-[#1e5a9d] px-4 py-2 text-xs font-semibold text-white disabled:opacity-60">{title === 'Import data' ? (file ? 'Import students CSV' : 'Select a CSV file') : 'Export data'}</button><button disabled={busy} onClick={title === 'Import data' ? undefined : () => void downloadTemplate()} className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 disabled:opacity-60">Download template</button></div></section>)}</div></>
}

function SettingsPage({ notify, user }: { notify: (s: string) => void; user: ApiUser }) {
  const { settings, error, loaded } = useApiSettings()
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const form = e.target as HTMLFormElement
    const orgName = (form.elements.namedItem('org') as HTMLInputElement)?.value?.trim() || 'UniCore University'
    const fullName = (form.elements.namedItem('name') as HTMLInputElement)?.value?.trim() || user.fullName
    setBusy(true)
    try {
      const keys: Record<string, string> = { org_name: orgName }
      if (settings) {
        if (settings.currency) keys.currency = settings.currency
        if (settings.currency_minor_units) keys.currency_minor_units = settings.currency_minor_units
      }
      await api('/api/settings', { method: 'PUT', body: { keys } })
      if (user.roleCode === 'administrator' && fullName && fullName !== user.fullName) {
        await api(`/api/users/${user.id}`, { method: 'PUT', body: { fullName } })
        setStoredUser({ ...user, fullName })
      }
      notify('Settings saved successfully')
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not save settings')
    } finally { setBusy(false) }
  }

  return <><div className="mb-7"><p className="mb-1 text-xs font-semibold uppercase tracking-[.13em] text-[#2e73b8]">Administration</p><h1 className="text-[26px] font-bold">Settings</h1><p className="mt-1 text-sm text-slate-500">Manage your profile and university display preferences.</p></div><div className="max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="font-bold">Profile details</h2><form onSubmit={submit} className="mt-5 grid gap-4 sm:grid-cols-2"><label className="text-xs font-semibold text-slate-600">Full name<input name="name" type="text" defaultValue={user?.fullName || ''} disabled={user?.roleCode !== 'administrator'} className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal" /></label><label className="text-xs font-semibold text-slate-600">Email<input defaultValue={user?.email || ''} disabled className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal" /></label><label className="text-xs font-semibold text-slate-600 sm:col-span-2">University name<input name="org" type="text" defaultValue={loaded ? (settings?.org_name || 'UniCore University') : ''} key={settings?.org_name || 'org-loading'} className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal" /></label>{error && <p role="alert" className="text-xs text-red-600 sm:col-span-2">{error}</p>}<div className="sm:col-span-2"><button type="submit" disabled={busy} className="mt-1 rounded-lg bg-[#1e5a9d] px-4 py-2 text-xs font-semibold text-white disabled:opacity-60">{busy ? 'Saving…' : 'Save changes'}</button></div></form></div></>
}

function setStoredUser(user: ApiUser) {
  try { window.localStorage.setItem('unicore.user', JSON.stringify(user)) } catch { /* ignore */ }
}

function useApiSettings() {
  const [settings, setSettings] = useState<{ org_name?: string; currency?: string; currency_minor_units?: string } | null>(null)
  const [error, setError] = useState('')
  const [loaded, setLoaded] = useState(false)
  useEffect(() => {
    api<Record<string, string>>('/api/settings')
      .then(res => setSettings({ org_name: res.org_name, currency: res.currency, currency_minor_units: res.currency_minor_units }))
      .catch(() => { /* non-admin roles cannot read settings — defaults stay */ })
      .finally(() => setLoaded(true))
  }, [])
  return { settings, error, loaded }
}

export default function Page() {
  const [user, setUser] = useState<ApiUser | null>(null)
  const [ready, setReady] = useState(false)
  const [active, setActive] = useState('Dashboard')
  const [sidebar, setSidebar] = useState(true); const [mobile, setMobile] = useState(false)
  const [modal, setModal] = useState<{ title: string; fields: string[]; selects?: Record<string, SelectOption[]>; onSubmit: (r: Row) => Promise<void> | void } | null>(null)
  const [toast, setToast] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const [currency, setCurrency] = useState('USD')

  // Restore an existing session (or discard an expired token) on first load.
  useEffect(() => {
    let cancelled = false
    const stored = getStoredUser(); const token = getToken()
    if (stored && !user) setUser(stored)
    if (!token) { setReady(true); return }
    api<ApiUser>('/api/auth/me')
      .then(me => { if (!cancelled) setUser({ ...me, roleName: ROLE_LABELS[me.roleCode] || me.roleName }) })
      .catch(err => { if (isAuthError(err)) clearSession() })
      .finally(() => { if (!cancelled) setReady(true) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Load the org currency for live money display (settings are admin-readable).
  useEffect(() => {
    if (!user) return
    api<Record<string, string>>('/api/settings').then(s => { if (s.currency) setCurrency(s.currency) }).catch(() => undefined)
  }, [user])

  const notify = (s: string) => { setToast(s); setTimeout(() => setToast(''), 2500) }
  const go = (x: string) => { setActive(x); setMobile(false) }

  const logout = () => {
    api('/api/auth/logout', { method: 'POST', skipToken: true }).catch(() => undefined)
    clearSession(); setUser(null)
  }

  // ---- Add flows wired to the REST API -----------------------------------------
  const openStudentAdd = async () => {
    try {
      const programmes = await api<{ id: number; name: string }[]>('/api/programmes?all=1')
      setModal({ title: 'Register Student', fields: ['number', 'name', 'email', 'phone', 'programme', 'date'], selects: { programme: programmes.map(p => ({ value: String(p.id), label: p.name })) }, onSubmit: submitStudent })
    } catch (err) {
      notify(err instanceof Error ? `${err.message}` : 'Could not load programmes')
    }
  }
  const openProgrammeAdd = () => setModal({ title: 'Add programme', fields: ['code', 'name', 'level'], selects: {}, onSubmit: submitProgramme })
  const openEmployeeAdd = async () => {
    try {
      const departments = await api<{ id: number; name: string }[]>('/api/departments?all=1')
      setModal({ title: 'Add employee', fields: ['number', 'name', 'email', 'phone', 'department', 'job', 'date'], selects: { department: departments.map(d => ({ value: String(d.id), label: d.name })) }, onSubmit: submitEmployee })
    } catch (err) {
      notify(err instanceof Error ? `${err.message}` : 'Could not load departments')
    }
  }
  const openUserAdd = () => setModal({ title: 'Add user', fields: ['name', 'email', 'role'], selects: { role: Object.entries(ROLE_LABELS).map(([value, label]) => ({ value, label })) }, onSubmit: submitUser })

  const onNavAdd = () => {
    if (active === 'Students') void openStudentAdd()
    else if (active === 'Programmes') openProgrammeAdd()
    else if (active === 'Human resources') void openEmployeeAdd()
    else if (active === 'User management') openUserAdd()
  }

  if (!ready) return null
  if (!user) return <LoginPage onLogin={u => { setUser(u); setActive('Dashboard') }} />

  const tableKind = { Students: 'student', Programmes: 'programme', 'Human resources': 'employee', 'User management': 'user' }[active] as 'student' | 'programme' | 'employee' | 'user' | undefined

  return <div className="min-h-screen bg-[#f7f9fc] text-[#172b45]"><button onClick={logout} aria-label="Log out" title="Log out" className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-lg hover:bg-slate-50"><LogOut className="size-4" />Log out</button>{mobile && <button aria-label="Close navigation" className="fixed inset-0 z-20 bg-slate-950/30 lg:hidden" onClick={() => setMobile(false)} />}<aside className={`fixed inset-y-0 left-0 z-30 flex flex-col border-r border-slate-200 bg-white transition-all ${sidebar ? 'w-[248px]' : 'w-[76px]'} ${mobile ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}><div className="flex h-[76px] items-center border-b border-slate-100 px-5"><Logo compact={!sidebar} /><button className="ml-auto hidden lg:block" onClick={() => setSidebar(!sidebar)} aria-label="Collapse navigation">{sidebar ? <PanelLeftClose className="size-5 text-slate-400" /> : <PanelLeftOpen className="size-5 text-slate-400" />}</button><button className="ml-auto lg:hidden" onClick={() => setMobile(false)}><X className="size-5" /></button></div><nav className="flex-1 px-3 py-6"><p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[.16em] text-slate-400">{sidebar ? 'Workspace' : '•••'}</p>{nav.map(([label, Icon]) => <button key={label} onClick={() => go(label)} title={label} className={`mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] font-medium ${active === label ? 'bg-[#eaf1fb] text-[#1c5aa6]' : 'text-slate-500 hover:bg-slate-50'} ${!sidebar && 'justify-center'}`}><Icon className="size-[18px] shrink-0" />{sidebar && label}</button>)}<p className="mb-3 mt-8 px-3 text-[10px] font-bold uppercase tracking-[.16em] text-slate-400">{sidebar ? 'Administration' : '•••'}</p>{admin.map(([label, Icon]) => <button key={label} onClick={() => go(label)} title={label} className={`mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] font-medium ${active === label ? 'bg-[#eaf1fb] text-[#1c5aa6]' : 'text-slate-500 hover:bg-slate-50'} ${!sidebar && 'justify-center'}`}><Icon className="size-[18px] shrink-0" />{sidebar && label}</button>)}</nav>{sidebar && <SystemStatus />}</aside><div className={`${sidebar ? 'lg:ml-[248px]' : 'lg:ml-[76px]'}`}><header className="sticky top-0 z-10 flex h-[76px] items-center justify-between border-b border-slate-200 bg-white/95 px-5 backdrop-blur lg:px-8"><div className="flex items-center gap-3"><button className="lg:hidden" onClick={() => setMobile(true)} aria-label="Open navigation"><Menu className="size-5 text-slate-500" /></button><div className="hidden lg:block"><p className="text-xs text-slate-400">{headerDate(new Date())}</p><p className="mt-1 text-sm font-semibold">Good {daypart()}, {firstName(user.fullName)}</p></div><div className="lg:hidden"><Logo /></div></div><div className="flex items-center gap-3"><Bell className="size-[18px] text-slate-500" /><div className="grid size-9 place-items-center rounded-xl bg-[#dce9f9] text-xs font-bold text-[#1c5aa6]">{initials(user.fullName)}</div></div></header><main className="mx-auto max-w-[1440px] p-5 lg:p-8">{active === 'Dashboard' ? <Dashboard go={go} onRegister={() => void openStudentAdd()} role={user.roleName || ROLE_LABELS[user.roleCode] || user.roleCode} currency={currency} refreshKey={refreshKey} /> : active === 'Finance' ? <Finance notify={notify} currency={currency} refreshKey={refreshKey} /> : active === 'Import / export' ? <ImportExport notify={notify} onImported={() => setRefreshKey(k => k + 1)} /> : active === 'Settings' ? <SettingsPage notify={notify} user={user} /> : <TablePage title={active} description={`Manage ${active.toLowerCase()} records, statuses, and operational details.`} kind={tableKind!} refreshKey={refreshKey} onAdd={onNavAdd} notify={notify} />}</main></div>{modal && <Modal {...modal} onClose={() => setModal(null)} />}{toast && <div role="status" className="fixed bottom-5 right-5 z-50 rounded-xl bg-[#172b45] px-4 py-3 text-xs text-white shadow-xl">{toast}</div>}</div>

  // ---- Submit handlers (POST to the API, then refetch the workspace) -------------
  async function submitStudent(form: Row) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.date || '')) throw new Error('Use the date format YYYY-MM-DD')
    const name = String(form.name || '').trim(); const parts = name.split(/\s+/)
    const firstName = parts[0] || ''; const lastName = parts.slice(1).join(' ') || firstName
    if (!form.programme) throw new Error('Select a programme')
    await api('/api/students', { method: 'POST', body: { firstName, lastName, email: form.email, phone: form.phone || '', programmeId: Number(form.programme), admissionDate: form.date, status: 'active', ...(form.number ? { studentNumber: form.number } : {}) } })
    notify('Record saved successfully'); setRefreshKey(k => k + 1)
  }

  async function submitProgramme(form: Row) {
    await api('/api/programmes', { method: 'POST', body: { code: form.code, name: form.name, level: form.level || '', isActive: true } })
    notify('Record saved successfully'); setRefreshKey(k => k + 1)
  }

  async function submitEmployee(form: Row) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.date || '')) throw new Error('Use the date format YYYY-MM-DD')
    const name = String(form.name || '').trim(); const parts = name.split(/\s+/)
    const firstName = parts[0] || ''; const lastName = parts.slice(1).join(' ') || firstName
    if (!form.department) throw new Error('Select a department')
    await api('/api/employees', { method: 'POST', body: { firstName, lastName, email: form.email, phone: form.phone || '', departmentId: Number(form.department), jobTitle: form.job || '', employmentDate: form.date, status: 'active', ...(form.number ? { employeeNumber: form.number } : {}) } })
    notify('Record saved successfully'); setRefreshKey(k => k + 1)
  }

  async function submitUser(form: Row) {
    if (!form.password) throw new Error('Add a password (minimum 8 characters, letter and digit)')
    await api('/api/users', { method: 'POST', body: { fullName: form.name, email: form.email, password: form.password, roleCode: form.role } })
    notify('Record saved successfully'); setRefreshKey(k => k + 1)
  }
}

/** Sidebar system-status card, wired to the live /api/health endpoint. */
function SystemStatus() {
  const [ok, setOk] = useState(true)
  useEffect(() => {
    let cancelled = false
    api<{ ok: boolean }>('/api/health', { skipToken: true }).then(r => { if (!cancelled) setOk(!!r.ok) }).catch(() => { if (!cancelled) setOk(false) })
    return () => { cancelled = true }
  }, [])
  return <div className="m-3 rounded-2xl bg-[#f4f7fb] p-4 text-xs"><div className="flex items-center gap-2 font-semibold"><Activity className={`size-4 ${ok ? 'text-emerald-600' : 'text-red-600'}`} />System status</div><p className="mt-2 text-[11px] text-slate-500">All systems operational</p></div>
}

// ---- Small formatting helpers ---------------------------------------------------

function headerDate(d: Date) { return d.toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }) }
function daypart() { const h = new Date().getHours(); return h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening' }
function firstName(full: string) { return (full || '').trim().split(/\s+/)[0] || 'Admin' }
function initials(full: string) { const words = (full || '').trim().split(/\s+/).filter(Boolean); if (!words.length) return 'JD'; return words.slice(0, 2).map(w => w[0]?.toUpperCase() || '').join('') }
