import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api, ApiClientError } from "../api";
import { PageHeader } from "../components/Layout";
import { EmptyState, ErrorBanner, Field, Modal, Spinner } from "../components/ui";

interface Programme {
  id: number;
  code: string;
  name: string;
  level: string;
  isActive: number | boolean;
}

const emptyForm = { code: "", name: "", level: "", isActive: true };

export default function ProgrammesPage() {
  const [programmes, setProgrammes] = useState<Programme[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Programme | "new" | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    api.get<Programme[]>("/programmes?all=1")
      .then(setProgrammes)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load programmes"));
  }, []);

  useEffect(load, [load]);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormErrors({});
    try {
      const payload = { code: form.code, name: form.name, level: form.level, isActive: form.isActive };
      if (editing === "new") await api.post("/programmes", payload);
      else if (editing) {
        // code cannot change after creation; send existing code for consistency
        await api.put(`/programmes/${editing.id}`, payload);
      }
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
        title="Programmes"
        subtitle="Academic programmes students can enrol in"
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
            + New programme
          </button>
        }
      />
      {error && <ErrorBanner message={error} onClose={() => setError(null)} />}
      {!programmes ? (
        <Spinner />
      ) : programmes.length === 0 ? (
        <div className="card">
          <EmptyState title="No programmes yet" hint="Create a programme before registering students." />
        </div>
      ) : (
        <div className="table-wrap">
          <table className="w-full">
            <thead className="border-b border-gray-100 bg-gray-50/60">
              <tr>
                <th className="th">Code</th>
                <th className="th">Name</th>
                <th className="th">Level</th>
                <th className="th">Status</th>
                <th className="th text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {programmes.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="td font-medium">{p.code}</td>
                  <td className="td text-gray-600">{p.name}</td>
                  <td className="td text-gray-600">{p.level || "—"}</td>
                  <td className="td">{p.isActive ? <span className="badge-green">Active</span> : <span className="badge-gray">Inactive</span>}</td>
                  <td className="td text-right">
                    <button
                      type="button"
                      className="btn-secondary !px-2 !py-1 text-xs"
                      onClick={() => {
                        setForm({ code: p.code, name: p.name, level: p.level, isActive: Boolean(p.isActive) });
                        setFormErrors({});
                        setEditing(p);
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

      <Modal open={editing !== null} title={editing === "new" ? "New programme" : "Edit programme"} onClose={() => setEditing(null)}>
        <form className="space-y-3" onSubmit={save} noValidate>
          <Field label="Programme code" error={formErrors.code} hint={editing === "new" ? "Letters, digits and dashes, e.g. BSCS-SW" : "Code cannot change"}>
            <input className="input" value={form.code} disabled={editing !== "new"} onChange={(e) => setForm({ ...form, code: e.target.value })} required={editing === "new"} />
          </Field>
          <Field label="Programme name" error={formErrors.name}>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </Field>
          <Field label="Level" error={formErrors.level}>
            <select className="input" value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })}>
              <option value="">Not set</option>
              <option value="Undergraduate">Undergraduate</option>
              <option value="Postgraduate">Postgraduate</option>
              <option value="Diploma">Diploma</option>
              <option value="Certificate">Certificate</option>
            </select>
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
              {saving ? "Saving…" : "Save programme"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
