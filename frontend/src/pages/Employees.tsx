import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api, ApiClientError } from "../api";
import { PageHeader } from "../components/Layout";
import { ConfirmDialog, EmptyState, ErrorBanner, Field, Modal, Pagination, Spinner, StatusBadge } from "../components/ui";

interface Employee {
  id: number;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  departmentId: number;
  departmentName: string | null;
  jobTitle: string;
  employmentDate: string;
  status: string;
}

interface Department {
  id: number;
  name: string;
}

interface ListResponse {
  data: Employee[];
  page: number;
  total: number;
  totalPages: number;
}

const emptyForm = { firstName: "", lastName: "", email: "", phone: "", departmentId: "", jobTitle: "", employmentDate: "" };

export default function EmployeesPage() {
  const [list, setList] = useState<ListResponse | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [q, setQ] = useState("");
  const [dept, setDept] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [editing, setEditing] = useState<Employee | "new" | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [confirmDeactivate, setConfirmDeactivate] = useState<Employee | null>(null);
  const [confirmActivate, setConfirmActivate] = useState<Employee | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: "10" });
      if (q) params.set("q", q);
      if (dept) params.set("departmentId", dept);
      if (status) params.set("status", status);
      setList(await api.get<ListResponse>(`/employees?${params}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load employees");
    } finally {
      setLoading(false);
    }
  }, [q, dept, status, page]);

  useEffect(() => {
    api.get<Department[]>("/departments").then(setDepartments).catch(() => setDepartments([]));
  }, []);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

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
        departmentId: Number(form.departmentId),
        jobTitle: form.jobTitle,
        employmentDate: form.employmentDate,
      };
      if (editing === "new") await api.post("/employees", payload);
      else if (editing) await api.put(`/employees/${editing.id}`, payload);
      setEditing(null);
      load();
    } catch (err) {
      if (err instanceof ApiClientError && err.details) setFormErrors(err.details);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Employees"
        subtitle="Employee records and employment details"
        actions={
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              setForm(emptyForm);
              setFormErrors({});
              setEditing("new");
            }}
          >
            + Register employee
          </button>
        }
      />

      {error && <ErrorBanner message={error} onClose={() => setError(null)} />}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          className="input max-w-xs"
          placeholder="Search name, email or number…"
          aria-label="Search employees"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
        />
        <select className="input max-w-[190px]" aria-label="Filter by department" value={dept} onChange={(e) => { setDept(e.target.value); setPage(1); }}>
          <option value="">All departments</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
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
          <EmptyState title="No employees found" hint="Adjust the filters or register a new employee." />
        </div>
      ) : list ? (
        <>
          <div className="table-wrap">
            <table className="w-full">
              <thead className="border-b border-gray-100 bg-gray-50/60">
                <tr>
                  <th className="th">Employee</th>
                  <th className="th">Department</th>
                  <th className="th">Job title</th>
                  <th className="th">Employed</th>
                  <th className="th">Status</th>
                  <th className="th text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {list.data.map((emp) => (
                  <tr key={emp.id} className="hover:bg-gray-50">
                    <td className="td">
                      <span className="font-medium">{emp.firstName} {emp.lastName}</span>
                      <span className="ml-2 text-xs text-gray-400">{emp.employeeNumber}</span>
                    </td>
                    <td className="td text-gray-600">{emp.departmentName ?? "—"}</td>
                    <td className="td text-gray-600">{emp.jobTitle || "—"}</td>
                    <td className="td text-gray-600">{emp.employmentDate}</td>
                    <td className="td">
                      <StatusBadge status={emp.status} />
                    </td>
                    <td className="td text-right">
                      <div className="flex justify-end gap-1.5">
                        <button
                          type="button"
                          className="btn-secondary !px-2 !py-1 text-xs"
                          onClick={() => {
                            setForm({
                              firstName: emp.firstName,
                              lastName: emp.lastName,
                              email: emp.email,
                              phone: emp.phone,
                              departmentId: String(emp.departmentId ?? ""),
                              jobTitle: emp.jobTitle,
                              employmentDate: emp.employmentDate,
                            });
                            setFormErrors({});
                            setEditing(emp);
                          }}
                        >
                          Edit
                        </button>
                        {emp.status === "active" ? (
                          <button type="button" className="btn-secondary !px-2 !py-1 text-xs text-red-600" onClick={() => setConfirmDeactivate(emp)}>
                            Deactivate
                          </button>
                        ) : (
                          <button type="button" className="btn-secondary !px-2 !py-1 text-xs" onClick={() => setConfirmActivate(emp)}>
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

      <Modal open={editing !== null} title={editing === "new" ? "Register employee" : "Edit employee"} onClose={() => setEditing(null)} wide>
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
          <Field label="Department" error={formErrors.departmentId}>
            <select className="input" value={form.departmentId} onChange={(e) => setForm({ ...form, departmentId: e.target.value })} required>
              <option value="">Select department…</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Job title" error={formErrors.jobTitle}>
            <input className="input" value={form.jobTitle} onChange={(e) => setForm({ ...form, jobTitle: e.target.value })} />
          </Field>
          <Field label="Employment date" error={formErrors.employmentDate}>
            <input className="input" type="date" value={form.employmentDate} onChange={(e) => setForm({ ...form, employmentDate: e.target.value })} required />
          </Field>
          <div className="col-span-full mt-2 flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => setEditing(null)}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? "Saving…" : "Save employee"}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={confirmDeactivate !== null}
        title="Deactivate employee"
        message={`${confirmDeactivate?.firstName} ${confirmDeactivate?.lastName} will be marked inactive. Historical records are preserved.`}
        confirmLabel="Deactivate"
        dangerous
        onConfirm={async () => {
          const target = confirmDeactivate;
          setConfirmDeactivate(null);
          if (target) {
            try {
              await api.patch(`/employees/${target.id}/status`, { status: "inactive" });
              load();
            } catch (err) {
              setError(err instanceof Error ? err.message : "Could not deactivate");
            }
          }
        }}
        onCancel={() => setConfirmDeactivate(null)}
      />
      <ConfirmDialog
        open={confirmActivate !== null}
        title="Reactivate employee"
        message={`Reactivate ${confirmActivate?.firstName} ${confirmActivate?.lastName}?`}
        confirmLabel="Reactivate"
        onConfirm={async () => {
          const target = confirmActivate;
          setConfirmActivate(null);
          if (target) {
            try {
              await api.patch(`/employees/${target.id}/status`, { status: "active" });
              load();
            } catch (err) {
              setError(err instanceof Error ? err.message : "Could not reactivate");
            }
          }
        }}
        onCancel={() => setConfirmActivate(null)}
      />
    </div>
  );
}
