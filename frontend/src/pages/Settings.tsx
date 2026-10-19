import { useEffect, useState, type FormEvent } from "react";
import { api, ApiClientError } from "../api";
import { PageHeader } from "../components/Layout";
import { ErrorBanner, Field, Spinner } from "../components/ui";

interface SettingsData {
  org_name: string;
  currency: string;
  currency_minor_units: string;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [pwForm, setPwForm] = useState({ currentPassword: "", newPassword: "", confirm: "" });
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwNotice, setPwNotice] = useState<string | null>(null);

  useEffect(() => {
    api.get<SettingsData>("/settings")
      .then(setSettings)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load settings"));
  }, []);

  const saveSettings = async (e: FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    setNotice(null);
    try {
      await api.put("/settings", {
        keys: {
          org_name: settings.org_name,
          currency: settings.currency,
          currency_minor_units: settings.currency_minor_units,
        },
      });
      setNotice("Settings saved.");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async (e: FormEvent) => {
    e.preventDefault();
    setPwError(null);
    if (pwForm.newPassword !== pwForm.confirm) {
      setPwError("New passwords do not match");
      return;
    }
    try {
      await api.post("/auth/change-password", {
        currentPassword: pwForm.currentPassword,
        newPassword: pwForm.newPassword,
      });
      setPwForm({ currentPassword: "", newPassword: "", confirm: "" });
      setPwNotice("Password changed.");
    } catch (err) {
      setPwError(err instanceof ApiClientError ? err.message : "Change failed");
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Settings" subtitle="Organisation details and your account" />
      {error && <ErrorBanner message={error} onClose={() => setError(null)} />}

      {!settings ? (
        <Spinner />
      ) : (
        <>
          <form className="card p-5" onSubmit={saveSettings}>
            <h2 className="mb-3 text-sm font-semibold">Organisation</h2>
            {notice && (
              <p className="mb-3 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">{notice}</p>
            )}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Field label="Organisation name">
                  <input className="input" value={settings.org_name} onChange={(e) => setSettings({ ...settings, org_name: e.target.value })} required />
                </Field>
              </div>
              <Field label="Currency code" hint="ISO-4217 code, e.g. ZAR, USD">
                <input className="input" value={settings.currency} maxLength={3} onChange={(e) => setSettings({ ...settings, currency: e.target.value.toUpperCase() })} required />
              </Field>
              <Field label="Minor units" hint="Digits after the decimal point (2 = cents)">
                <input className="input" type="number" min={0} max={4} value={settings.currency_minor_units} onChange={(e) => setSettings({ ...settings, currency_minor_units: e.target.value })} required />
              </Field>
            </div>
            <div className="mt-4 flex justify-end">
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? "Saving…" : "Save settings"}
              </button>
            </div>
          </form>
        </>
      )}

      <form className="card mt-6 p-5" onSubmit={changePassword}>
        <h2 className="mb-3 text-sm font-semibold">Change your password</h2>
        {pwNotice && (
          <p className="mb-3 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">{pwNotice}</p>
        )}
        {pwError && (
          <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
            {pwError}
          </p>
        )}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Current password">
            <input className="input" type="password" autoComplete="current-password" value={pwForm.currentPassword} onChange={(e) => setPwForm({ ...pwForm, currentPassword: e.target.value })} required />
          </Field>
          <Field label="New password" hint="8+ chars, letter + digit">
            <input className="input" type="password" autoComplete="new-password" value={pwForm.newPassword} onChange={(e) => setPwForm({ ...pwForm, newPassword: e.target.value })} required />
          </Field>
          <Field label="Confirm new password">
            <input className="input" type="password" autoComplete="new-password" value={pwForm.confirm} onChange={(e) => setPwForm({ ...pwForm, confirm: e.target.value })} required />
          </Field>
        </div>
        <div className="mt-4 flex justify-end">
          <button type="submit" className="btn-primary">
            Change password
          </button>
        </div>
      </form>
    </div>
  );
}
