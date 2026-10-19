import { useCallback, useState } from "react";
import { api, ApiClientError } from "../api";
import { PageHeader } from "../components/Layout";
import { Spinner } from "../components/ui";

const ENTITIES = [
  { key: "students", label: "Students" },
  { key: "programmes", label: "Programmes" },
  { key: "departments", label: "Departments" },
  { key: "employees", label: "Employees" },
  { key: "fee_charges", label: "Fee charges" },
  { key: "payments", label: "Payments" },
] as const;

type EntityKey = (typeof ENTITIES)[number]["key"];

interface ImportResult {
  entity: EntityKey;
  dryRun: boolean;
  successful: number;
  rejected: number;
  skipped: number;
  rows: { row: number; status: "imported" | "rejected" | "skipped"; errors: Record<string, string> }[];
}

export default function ImportExportPage() {
  const [entity, setEntity] = useState<EntityKey>("students");
  const [csv, setCsv] = useState("");
  const [useFile, setUseFile] = useState(false);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const run = useCallback(
    async (dryRun: boolean) => {
      setRunning(true);
      setResult(null);
      setError(null);
      setNotice(null);
      try {
        const res = await api.post<ImportResult>(`/import/${entity}`, { csv, dryRun });
        setResult(res);
        if (!dryRun) {
          setNotice(
            `Import finished: ${res.successful} imported, ${res.rejected} rejected, ${res.skipped} skipped.`
          );
        }
      } catch (err) {
        setError(err instanceof ApiClientError ? err.message : "Import failed");
      } finally {
        setRunning(false);
      }
    },
    [entity, csv]
  );

  const onFileSelected = async (file: File | undefined) => {
    if (!file) return;
    const text = await file.text();
    setCsv(text);
    setUseFile(true);
  };

  const loadTemplate = async () => {
    try {
      const text = await api.getText(`/export/${entity}.csv`);
      setCsv(text);
      setNotice("Loaded current data as a template — edit or clear rows you do not need.");
    } catch {
      setError("Could not load template");
    }
  };

  const exportNow = () => {
    // Trigger a file download through the authenticated API.
    api
      .getText(`/export/${entity}.csv?download=1`)
      .then((text) => {
        const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${entity}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      })
      .catch(() => setError("Export failed"));
  };

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Import / Export" subtitle="CSV migration with validation, dry-run and error reporting" />

      <div className="card p-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="label" htmlFor="entity-select">Data type</label>
            <select id="entity-select" className="input" value={entity} onChange={(e) => { setEntity(e.target.value as EntityKey); setResult(null); setNotice(null); }}>
              {ENTITIES.map((en) => (
                <option key={en.key} value={en.key}>
                  {en.label}
                </option>
              ))}
            </select>
            <div className="mt-3 flex gap-2">
              <button type="button" className="btn-secondary" onClick={loadTemplate}>
                Load current data as template
              </button>
              <button type="button" className="btn-secondary" onClick={exportNow}>
                Download CSV
              </button>
            </div>
            <p className="mt-3 text-xs text-gray-400">
              Sample templates with expected columns live in <code>csv-templates/</code> in the repository.
            </p>
          </div>

          <div>
            <label className="label">Paste CSV or choose a file</label>
            <input
              className="input"
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => onFileSelected(e.target.files?.[0])}
              aria-label="Choose CSV file"
            />
            <textarea
              className="input mt-2 min-h-36 font-mono text-xs"
              placeholder={`Paste ${entity} CSV content here…`}
              value={csv}
              onChange={(e) => {
                setCsv(e.target.value);
                setUseFile(false);
              }}
              aria-label="CSV content"
            />
          </div>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className="btn-secondary" disabled={running || !csv.trim()} onClick={() => run(true)}>
            Validate (dry run)
          </button>
          <button type="button" className="btn-primary" disabled={running || !csv.trim()} onClick={() => run(false)}>
            Import
          </button>
        </div>
      </div>

      {running && <Spinner label="Validating…" />}

      {error && (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}
      {useFile && !notice && <p className="mt-2 text-xs text-gray-400">Using the selected file's contents.</p>}
      {result && !notice && (
        <p className="mt-4 text-sm text-gray-600">
          Dry run: {result.successful} rows valid, {result.rejected} rejected, {result.skipped} skipped. No data
          was written.
        </p>
      )}
      {notice && (
        <p className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-2.5 text-sm text-green-700" role="status">
          {notice}
        </p>
      )}

      {result && result.rows.length > 0 && (
        <div className="table-wrap mt-4">
          <table className="w-full">
            <thead className="border-b border-gray-100 bg-gray-50/60">
              <tr>
                <th className="th">Row</th>
                <th className="th">Result</th>
                <th className="th">Problems</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {result.rows
                .filter((r) => r.status !== "imported" || Object.keys(r.errors).length > 0)
                .map((r) => (
                  <tr key={r.row}>
                    <td className="td">{r.row}</td>
                    <td className="td">
                      {r.status === "imported" && <span className="badge-green">Imported</span>}
                      {r.status === "rejected" && <span className="badge-red">Rejected</span>}
                      {r.status === "skipped" && <span className="badge-gray">Skipped</span>}
                    </td>
                    <td className="td text-xs text-gray-600">
                      {Object.entries(r.errors).map(([field, msg]) => (
                        <div key={field}>
                          <span className="font-medium">{field}:</span> {msg}
                        </div>
                      ))}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
