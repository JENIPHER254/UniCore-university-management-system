import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import { PageHeader } from "../components/Layout";
import { EmptyState, ErrorBanner, Spinner, StatusBadge } from "../components/ui";
import { formatDate, formatMoney } from "../format";

interface Profile {
  student: {
    id: number;
    studentNumber: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    programmeName: string | null;
    programmeCode: string | null;
    admissionDate: string;
    status: string;
    balanceCents: number;
  };
  charges: {
    id: number;
    chargeNumber: string;
    category: string;
    description: string;
    amountCents: number;
    allocatedCents: number;
    openCents: number;
    chargeDate: string;
  }[];
  payments: {
    id: number;
    paymentNumber: string;
    amountCents: number;
    method: string;
    reference: string;
    note: string;
    paymentDate: string;
    isReversed: number;
    reversalReason: string | null;
    reversedAt: string | null;
  }[];
  totals: {
    chargesCents: number;
    paymentsCents: number;
    outstandingCents: number;
  };
}

export default function StudentProfilePage() {
  const { id } = useParams<{ id: string }>();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<Profile>(`/students/${id}/profile`)
      .then(setProfile)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load student"));
  }, [id]);

  if (error) return <ErrorBanner message={error} />;
  if (!profile) return <Spinner />;

  const s = profile.student;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title={`${s.firstName} ${s.lastName}`}
        subtitle={`${s.studentNumber} · ${s.programmeName ?? "No programme"} · admitted ${formatDate(s.admissionDate)}`}
        actions={
          <>
            <StatusBadge status={s.status} />
            <Link className="btn-secondary" to="/students">
              Back to students
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="card p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Total charges</p>
          <p className="mt-1 text-xl font-semibold">{formatMoney(profile.totals.chargesCents)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Payments received</p>
          <p className="mt-1 text-xl font-semibold">{formatMoney(profile.totals.paymentsCents)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Outstanding</p>
          <p className={`mt-1 text-xl font-semibold ${profile.totals.outstandingCents > 0 ? "text-red-600" : ""}`}>
            {formatMoney(profile.totals.outstandingCents)}
          </p>
        </div>
      </div>

      <section className="mt-6" aria-label="Fee charges">
        <h2 className="mb-2 text-sm font-semibold">Fee charges</h2>
        {profile.charges.length === 0 ? (
          <div className="card"><EmptyState title="No charges recorded" /></div>
        ) : (
          <div className="table-wrap">
            <table className="w-full">
              <thead className="border-b border-gray-100 bg-gray-50/60">
                <tr>
                  <th className="th">Charge</th>
                  <th className="th">Description</th>
                  <th className="th">Category</th>
                  <th className="th">Date</th>
                  <th className="th text-right">Amount</th>
                  <th className="th text-right">Open</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {profile.charges.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="td font-medium">{c.chargeNumber}</td>
                    <td className="td text-gray-600">{c.description}</td>
                    <td className="td text-gray-600 capitalize">{c.category}</td>
                    <td className="td text-gray-600">{formatDate(c.chargeDate)}</td>
                    <td className="td text-right">{formatMoney(c.amountCents)}</td>
                    <td className={`td text-right font-medium ${c.openCents > 0 ? "text-red-600" : ""}`}>{formatMoney(c.openCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-6" aria-label="Payment history">
        <h2 className="mb-2 text-sm font-semibold">Payment history</h2>
        {profile.payments.length === 0 ? (
          <div className="card"><EmptyState title="No payments recorded" /></div>
        ) : (
          <div className="table-wrap">
            <table className="w-full">
              <thead className="border-b border-gray-100 bg-gray-50/60">
                <tr>
                  <th className="th">Payment</th>
                  <th className="th">Method</th>
                  <th className="th">Reference</th>
                  <th className="th">Date</th>
                  <th className="th text-right">Amount</th>
                  <th className="th">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {profile.payments.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="td font-medium">
                      {p.paymentNumber}
                      {p.note && <span className="ml-2 text-xs text-gray-400">{p.note}</span>}
                    </td>
                    <td className="td text-gray-600 capitalize">{p.method.replace("_", " ")}</td>
                    <td className="td text-gray-600">{p.reference || "—"}</td>
                    <td className="td text-gray-600">{formatDate(p.paymentDate)}</td>
                    <td className="td text-right font-medium">{formatMoney(p.amountCents)}</td>
                    <td className="td">
                      {p.isReversed ? (
                        <span className="badge-red" title={p.reversalReason ?? ""}>
                          Reversed{p.reversalReason ? ` · ${p.reversalReason}` : ""}
                        </span>
                      ) : (
                        <span className="badge-green">Valid</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
