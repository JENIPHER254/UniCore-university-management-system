import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api, ApiClientError } from "../api";
import { PageHeader } from "../components/Layout";
import { EmptyState, ErrorBanner, Field, Modal, Spinner } from "../components/ui";

interface Department {
  id: number;
  code: string;
  name: string;
  isActive: number | boolean;
}

const emptyForm = { code: "", name: "", isActive: true };

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState<Department[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Department | "new" | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    api.get<Department[]>("/departments?all=1")
      .then(setDepartments)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load departments"));
  }, []);

  useEffect(load, [load]);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormErrors({});
    try {
      if (editing === "new") await api.post("/departments", form);
      else if (editing) await api.put(`/departments/${editing.id}`, form);
      setEditing(null);
      load();
    } catch (err) {
      if (err instanceof ApiClientError && err.details) setFormErrors(err.details);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Departments"
        subtitle="Organisational departments"
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
            + New department
          </button>
        }
      />
      {error && <ErrorBanner message={error} onClose={() => setError(null)} />}
      {!departments ? (
        <Spinner />
      ) : departments.length === 0 ? (
        <div className="card">
          <EmptyState title="No departments yet" hint="Create a department before adding employees." />
        </div>
      ) : (
        <div className="table-wrap">
          <table className="w-full">
            <thead className="border-b border-gray-100 bg-gray-50/60">
              <tr>
                <th className="th">Code</th>
                <th className="th">Name</th>
                <th className="th">Status</th>
                <th className="th text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {departments.map((d) => (
                <tr key={d.id} className="hover:bg-gray-50">
                  <td className="td font-medium">{d.code}</td>
                  <td className="td text-gray-600">{d.name}</td>
                  <td className="td">{d.isActive ? <span className="badge-green">Active</span> : <span className="badge-gray">Inactive</span>}</td>
                  <td className="td text-right">
                    <button
                      type="button"
                      className="btn-secondary !px-2 !py-1 text-xs"
                      onClick={() => {
                        setForm({ code: d.code, name: d.name, isActive: Boolean(d.isActive) });
                        setFormErrors({});
                        setEditing(d);
                      }}
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={editing !== null} title={editing === "new" ? "New department" : "Edit department"} onClose={() => setEditing(null)}>
        <form className="space-y-3" onSubmit={save} noValidate>
          <Field label="Department code" error={formErrors.code} hint={editing === "new" ? "Letters, digits and dashes, e.g. ACAD" : "Code cannot change"}>
            <input
              className="input"
              value={form.code}
              disabled={editing !== "new"}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              required={editing === "new"}
            />
          </Field>
          <Field label="Department name" error={formErrors.name}>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </Field>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
            Active
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-secondary" onClick={() => setEditing(null)}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? "Saving…" : "Save department"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
