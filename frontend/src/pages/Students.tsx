import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api, ApiClientError } from "../api";
import { PageHeader } from "../components/Layout";
import { ConfirmDialog, EmptyState, ErrorBanner, Field, Modal, Pagination, Spinner, StatusBadge } from "../components/ui";
import { formatMoney } from "../format";

interface Student {
  id: number;
  studentNumber: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  programmeId: number;
  programmeName: string | null;
  admissionDate: string;
  status: string;
  balanceCents: number;
}

interface Programme {
  id: number;
  code: string;
  name: string;
}

interface ListResponse {
  data: Student[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

const emptyForm = { firstName: "", lastName: "", email: "", phone: "", programmeId: "", admissionDate: "" };

export default function StudentsPage() {
  const [list, setList] = useState<ListResponse | null>(null);
  const [programmes, setProgrammes] = useState<Programme[]>([]);
  const [q, setQ] = useState("");
  const [programmeId, setProgrammeId] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [editing, setEditing] = useState<Student | "new" | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [confirmDeactivate, setConfirmDeactivate] = useState<Student | null>(null);
  const [confirmActivate, setConfirmActivate] = useState<Student | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (programmeId) params.set("programmeId", programmeId);
      if (status) params.set("status", status);
      params.set("page", String(page));
      params.set("pageSize", "10");
      setList(await api.get<ListResponse>(`/students?${params}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load students");
    } finally {
      setLoading(false);
    }
  }, [q, programmeId, status, page]);

  useEffect(() => {
    api.get<Programme[]>("/programmes").then(setProgrammes).catch(() => setProgrammes([]));
  }, []);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const openNew = () => {
    setForm(emptyForm);
    setFormErrors({});
    setEditing("new");
  };

  const openEdit = (s: Student) => {
    setForm({
      firstName: s.firstName,
      lastName: s.lastName,
      email: s.email,
      phone: s.phone,
      programmeId: String(s.programmeId ?? ""),
      admissionDate: s.admissionDate,
    });
    setFormErrors({});
    setEditing(s);
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormErrors({});
    try {
      const payload = {
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        phone: form.phone,
        programmeId: Number(form.programmeId),
        admissionDate: form.admissionDate,
      };
      if (editing === "new") await api.post("/students", payload);
      else if (editing) await api.put(`/students/${editing.id}`, payload);
      setEditing(null);
      load();
    } catch (err) {
      if (err instanceof ApiClientError && err.details) setFormErrors(err.details);
      setError(err instanceof ApiClientError || err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const deactivate = async (s: Student) => {
    setConfirmDeactivate(null);
    try {
      await api.patch(`/students/${s.id}/status`, { status: "inactive" });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not deactivate");
    }
  };

  const activate = async (s: Student) => {
    setConfirmActivate(null);
    try {
      await api.patch(`/students/${s.id}/status`, { status: "active" });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reactivate");
    }
  };

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Students"
        subtitle="Register, search and maintain student records"
        actions={
          <button type="button" className="btn-primary" onClick={openNew}>
            + Register student
          </button>
        }
      />

      {error && <ErrorBanner message={error} onClose={() => setError(null)} />}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          className="input max-w-xs"
          placeholder="Search name, email or number…"
          aria-label="Search students"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
        />
        <select className="input max-w-[190px]" aria-label="Filter by programme" value={programmeId} onChange={(e) => { setProgrammeId(e.target.value); setPage(1); }}>
          <option value="">All programmes</option>
          {programmes.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <select className="input max-w-[140px]" aria-label="Filter by status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {loading && !list ? (
        <Spinner />
      ) : list && list.data.length === 0 ? (
        <div className="card">
          <EmptyState title="No students found" hint="Adjust the filters or register a new student." />
        </div>
      ) : list ? (
        <>
          <div className="table-wrap">
            <table className="w-full">
              <thead className="border-b border-gray-100 bg-gray-50/60">
                <tr>
                  <th className="th">Student</th>
                  <th className="th">Programme</th>
                  <th className="th">Admitted</th>
                  <th className="th">Status</th>
                  <th className="th text-right">Balance</th>
                  <th className="th text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {list.data.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="td">
                      <Link className="font-medium text-primary-700 hover:underline" to={`/students/${s.id}`}>
                        {s.firstName} {s.lastName}
                      </Link>
                      <span className="ml-2 text-xs text-gray-400">{s.studentNumber}</span>
                    </td>
                    <td className="td text-gray-600">{s.programmeName ?? "—"}</td>
                    <td className="td text-gray-600">{s.admissionDate}</td>
                    <td className="td">
                      <StatusBadge status={s.status} />
                    </td>
                    <td className={`td text-right font-medium ${s.balanceCents > 0 ? "text-red-600" : "text-gray-900"}`}>
                      {formatMoney(s.balanceCents)}
                    </td>
                    <td className="td text-right">
                      <div className="flex justify-end gap-1.5">
                        <button type="button" className="btn-secondary !px-2 !py-1 text-xs" onClick={() => openEdit(s)}>
                          Edit
                        </button>
                        {s.status === "active" ? (
                          <button type="button" className="btn-secondary !px-2 !py-1 text-xs text-red-600" onClick={() => setConfirmDeactivate(s)}>
                            Deactivate
                          </button>
                        ) : (
                          <button type="button" className="btn-secondary !px-2 !py-1 text-xs" onClick={() => setConfirmActivate(s)}>
                            Reactivate
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={list.page} totalPages={list.totalPages} onPage={setPage} />
        </>
      ) : null}

      <Modal open={editing !== null} title={editing === "new" ? "Register student" : "Edit student"} onClose={() => setEditing(null)} wide>
        <form className="grid grid-cols-1 gap-3 sm:grid-cols-2" onSubmit={save} noValidate>
          <Field label="First name" error={formErrors.firstName}>
            <input className="input" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} required />
          </Field>
          <Field label="Last name" error={formErrors.lastName}>
            <input className="input" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} required />
          </Field>
          <Field label="Email" error={formErrors.email}>
            <input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          </Field>
          <Field label="Phone" error={formErrors.phone}>
            <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </Field>
          <Field label="Programme" error={formErrors.programmeId}>
            <select className="input" value={form.programmeId} onChange={(e) => setForm({ ...form, programmeId: e.target.value })} required>
              <option value="">Select programme…</option>
              {programmes.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Admission date" error={formErrors.admissionDate}>
            <input className="input" type="date" value={form.admissionDate} onChange={(e) => setForm({ ...form, admissionDate: e.target.value })} required />
          </Field>
          <div className="col-span-full mt-2 flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => setEditing(null)}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? "Saving…" : "Save student"}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={confirmDeactivate !== null}
        title="Deactivate student"
        message={`${confirmDeactivate?.firstName} ${confirmDeactivate?.lastName} will be marked inactive. History and fees are preserved.`}
        confirmLabel="Deactivate"
        dangerous
        onConfirm={() => confirmDeactivate && deactivate(confirmDeactivate)}
        onCancel={() => setConfirmDeactivate(null)}
      />
      <ConfirmDialog
        open={confirmActivate !== null}
        title="Reactivate student"
        message={`Reactivate ${confirmActivate?.firstName} ${confirmActivate?.lastName}?`}
        confirmLabel="Reactivate"
        onConfirm={() => confirmActivate && activate(confirmActivate)}
        onCancel={() => setConfirmActivate(null)}
      />
    </div>
  );
}
