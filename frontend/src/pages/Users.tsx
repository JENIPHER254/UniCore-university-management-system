import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api, ApiClientError } from "../api";
import { PageHeader } from "../components/Layout";
import { ConfirmDialog, EmptyState, ErrorBanner, Field, Modal, Spinner } from "../components/ui";

interface UserRow {
  id: number;
  email: string;
  fullName: string;
  roleCode: string;
  roleName: string;
  isActive: number | boolean;
  createdAt: string;
}

const ROLES = [
  { code: "administrator", label: "Administrator" },
  { code: "finance_officer", label: "Finance Officer" },
  { code: "student_affairs_officer", label: "Student Affairs Officer" },
  { code: "hr_officer", label: "HR Officer" },
];

const emptyForm = { fullName: "", email: "", password: "", roleCode: "student_affairs_officer" };

export default function UsersPage() {
  const [users, setUsers] = useState<UserRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [confirmActive, setConfirmActive] = useState<UserRow | null>(null);

  const load = useCallback(() => {
    api.get<UserRow[]>("/users")
      .then(setUsers)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load users"));
  }, []);

  useEffect(load, [load]);

  const saveNew = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormErrors({});
    try {
      await api.post("/users", form);
      setCreating(false);
      setForm(emptyForm);
      setNotice("User created.");
      load();
    } catch (err) {
      if (err instanceof ApiClientError && err.details) setFormErrors(err.details);
    } finally {
      setSaving(false);
    }
  };

  const saveEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    setFormErrors({});
    try {
      await api.put(`/users/${editing.id}`, {
        fullName: editing.fullName,
        roleCode: editing.roleCode,
        isActive: Boolean(editing.isActive),
        ...(resetPassword ? { password: resetPassword } : {}),
      });
      setEditing(null);
      setResetPassword("");
      setNotice("User updated.");
      load();
    } catch (err) {
      if (err instanceof ApiClientError && err.details) setFormErrors(err.details);
      setError(err instanceof ApiClientError ? err.message : "Update failed");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (u: UserRow) => {
    setConfirmActive(null);
    try {
      await api.put(`/users/${u.id}`, { isActive: !u.isActive });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not change status");
    }
  };

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="User Management"
        subtitle="System users and their roles"
        actions={
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              setForm(emptyForm);
              setFormErrors({});
              setCreating(true);
            }}
          >
            + New user
          </button>
        }
      />
      {error && <ErrorBanner message={error} onClose={() => setError(null)} />}
      {notice && !error && (
        <p className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-2.5 text-sm text-green-700" role="status">
          {notice}
        </p>
      )}
      {!users ? (
        <Spinner />
      ) : users.length === 0 ? (
        <div className="card"><EmptyState title="No users yet" /></div>
      ) : (
        <div className="table-wrap">
          <table className="w-full">
            <thead className="border-b border-gray-100 bg-gray-50/60">
              <tr>
                <th className="th">User</th>
                <th className="th">Role</th>
                <th className="th">Status</th>
                <th className="th">Created</th>
                <th className="th text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="td">
                    <span className="font-medium">{u.fullName}</span>
                    <span className="ml-2 text-xs text-gray-400">{u.email}</span>
                  </td>
                  <td className="td text-gray-600">{u.roleName}</td>
                  <td className="td">{u.isActive ? <span className="badge-green">Active</span> : <span className="badge-gray">Deactivated</span>}</td>
                  <td className="td text-gray-600">{u.createdAt?.slice(0, 10)}</td>
                  <td className="td text-right">
                    <div className="flex justify-end gap-1.5">
                      <button type="button" className="btn-secondary !px-2 !py-1 text-xs" onClick={() => { setEditing(structuredClone(u)); setResetPassword(""); setFormErrors({}); }}>
                        Edit
                      </button>
                      <button type="button" className="btn-secondary !px-2 !py-1 text-xs text-red-600" onClick={() => setConfirmActive(u)}>
                        {u.isActive ? "Deactivate" : "Reactivate"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create user */}
      <Modal open={creating} title="New user" onClose={() => setCreating(false)}>
        <form className="space-y-3" onSubmit={saveNew} noValidate>
          <Field label="Full name" error={formErrors.fullName}>
            <input className="input" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} required />
          </Field>
          <Field label="Email" error={formErrors.email}>
            <input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          </Field>
          <Field label="Initial password" error={formErrors.password} hint="At least 8 characters with a letter and a digit">
            <input className="input" type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
          </Field>
          <Field label="Role" error={formErrors.roleCode}>
            <select className="input" value={form.roleCode} onChange={(e) => setForm({ ...form, roleCode: e.target.value })}>
              {ROLES.map((r) => (
                <option key={r.code} value={r.code}>
                  {r.label}
                </option>
              ))}
            </select>
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-secondary" onClick={() => setCreating(false)}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? "Creating…" : "Create user"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit user */}
      <Modal open={editing !== null} title="Edit user" onClose={() => { setEditing(null); setResetPassword(""); }}>
        {editing && (
          <form className="space-y-3" onSubmit={saveEdit} noValidate>
            <Field label="Full name" error={formErrors.fullName}>
              <input className="input" value={editing.fullName} onChange={(e) => setEditing({ ...editing, fullName: e.target.value })} required />
            </Field>
            <Field label="Email" hint="Email cannot change">
              <input className="input" value={editing.email} disabled />
            </Field>
            <Field label="Role" error={formErrors.roleCode}>
              <select className="input" value={editing.roleCode} onChange={(e) => setEditing({ ...editing, roleCode: e.target.value })}>
                {ROLES.map((r) => (
                  <option key={r.code} value={r.code}>
                    {r.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Reset password" error={formErrors.password} hint="Leave empty to keep the current password">
              <input className="input" type="text" value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} />
            </Field>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className="btn-secondary" onClick={() => { setEditing(null); setResetPassword(""); }}>
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? "Saving…" : "Save changes"}
              </button>
            </div>
          </form>
        )}
      </Modal>

      <ConfirmDialog
        open={confirmActive !== null}
        title={confirmActive?.isActive ? "Deactivate user" : "Reactivate user"}
        message={`${confirmActive?.fullName} will be ${confirmActive?.isActive ? "deactivated" : "reactivated"}. Deactivated users cannot sign in.`}
        confirmLabel={confirmActive?.isActive ? "Deactivate" : "Reactivate"}
        dangerous={Boolean(confirmActive?.isActive)}
        onConfirm={() => confirmActive && toggleActive(confirmActive)}
        onCancel={() => setConfirmActive(null)}
      />
    </div>
  );
}
