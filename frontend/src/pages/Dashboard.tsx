import { useEffect, useState } from "react";
import { api } from "../api";
import { PageHeader } from "../components/Layout";
import { ErrorBanner, Spinner, EmptyState } from "../components/ui";
import { formatDate, formatMoney } from "../format";

interface DashboardData {
  totals: {
    activeStudents: number;
    totalStudents: number;
    activeEmployees: number;
    paymentsReceivedCents: number;
    outstandingCents: number;
  };
  recentStudents: {
    id: number;
    studentNumber: string;
    firstName: string;
    lastName: string;
    programmeName: string | null;
    admissionDate: string;
    status: string;
  }[];
  recentPayments: {
    id: number;
    paymentNumber: string;
    amountCents: number;
    firstName: string | null;
    lastName: string | null;
    studentNumber: string | null;
    paymentDate: string;
    isReversed: number;
    method: string;
  }[];
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-xl font-semibold text-gray-900">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-gray-400">{sub}</p>}
    </div>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<DashboardData>("/dashboard")
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load dashboard"));
  }, []);

  if (error) return <ErrorBanner message={error} />;
  if (!data) return <Spinner />;

  const t = data.totals;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Dashboard" subtitle="Live figures from the database" />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Registered students" value={String(t.activeStudents)} sub={`${t.totalStudents} total incl. inactive`} />
        <StatCard label="Active employees" value={String(t.activeEmployees)} />
        <StatCard label="Payments received" value={formatMoney(t.paymentsReceivedCents)} sub="excludes reversals" />
        <StatCard label="Outstanding fees" value={formatMoney(t.outstandingCents)} sub="charges − valid payments" />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <section aria-label="Recent student registrations">
          <h2 className="mb-2 text-sm font-semibold text-gray-900">Recent student registrations</h2>
          {data.recentStudents.length === 0 ? (
            <div className="card"><EmptyState title="No students yet" hint="Add your first student to see it here." /></div>
          ) : (
            <div className="table-wrap">
              <table className="w-full">
                <thead className="border-b border-gray-100 bg-gray-50/60">
                  <tr>
                    <th className="th">Student</th>
                    <th className="th">Programme</th>
                    <th className="th">Admitted</th>
                    <th className="th">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.recentStudents.map((s) => (
                    <tr key={s.id} className="hover:bg-gray-50">
                      <td className="td">
                        <span className="font-medium">{s.firstName} {s.lastName}</span>
                        <span className="ml-2 text-xs text-gray-400">{s.studentNumber}</span>
                      </td>
                      <td className="td text-gray-600">{s.programmeName ?? "—"}</td>
                      <td className="td text-gray-600">{formatDate(s.admissionDate)}</td>
                      <td className="td">
                        {s.status === "active" ? <span className="badge-green">Active</span> : <span className="badge-gray">Inactive</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section aria-label="Recent payment transactions">
          <h2 className="mb-2 text-sm font-semibold text-gray-900">Recent payment transactions</h2>
          {data.recentPayments.length === 0 ? (
            <div className="card"><EmptyState title="No payments yet" hint="Recorded payments will appear here." /></div>
          ) : (
            <div className="table-wrap">
              <table className="w-full">
                <thead className="border-b border-gray-100 bg-gray-50/60">
                  <tr>
                    <th className="th">Reference</th>
                    <th className="th">Student</th>
                    <th className="th">Amount</th>
                    <th className="th">Date</th>
                    <th className="th">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.recentPayments.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="td">
                        <span className="font-medium">{p.paymentNumber}</span>
                        <span className="ml-2 text-xs capitalize text-gray-400">{p.method.replace("_", " ")}</span>
                      </td>
                      <td className="td text-gray-600">{p.firstName ? `${p.firstName} ${p.lastName}` : "—"}</td>
                      <td className="td font-medium">{formatMoney(p.amountCents)}</td>
                      <td className="td text-gray-600">{formatDate(p.paymentDate)}</td>
                      <td className="td">
                        {p.isReversed ? <span className="badge-red">Reversed</span> : <span className="badge-green">Valid</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
