import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api, ApiClientError } from "../api";
import { PageHeader } from "../components/Layout";
import { ConfirmDialog, EmptyState, ErrorBanner, Field, Modal, Pagination, ReversedBadge, Spinner } from "../components/ui";
import { formatDate, formatMoney } from "../format";

type StudentOption = { id: number; studentNumber: string; firstName: string; lastName: string };

interface Charge {
  id: number;
  chargeNumber: string;
  studentNumber: string;
  firstName: string;
  lastName: string;
  category: string;
  description: string;
  amountCents: number;
  openCents: number;
  chargeDate: string;
}

interface Payment {
  id: number;
  paymentNumber: string;
  studentNumber: string;
  firstName: string;
  lastName: string;
  amountCents: number;
  method: string;
  reference: string;
  note: string;
  paymentDate: string;
  isReversed: number;
  reversalReason: string | null;
}

interface ListResponse<T> {
  data: T[];
  page: number;
  total: number;
  totalPages: number;
}

const emptyCharge = { studentId: "", category: "tuition", description: "", amount: "", chargeDate: new Date().toISOString().slice(0, 10) };
const emptyPayment = { studentId: "", amount: "", method: "cash", reference: "", note: "", paymentDate: new Date().toISOString().slice(0, 10) };

export default function FinancePage() {
  const [tab, setTab] = useState<"payments" | "charges">("payments");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [charges, setCharges] = useState<ListResponse<Charge> | null>(null);
  const [payments, setPayments] = useState<ListResponse<Payment> | null>(null);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [chargeModal, setChargeModal] = useState(false);
  const [chargeForm, setChargeForm] = useState(emptyCharge);
  const [chargeErrors, setChargeErrors] = useState<Record<string, string>>({});
  const [paymentModal, setPaymentModal] = useState(false);
  const [paymentForm, setPaymentForm] = useState(emptyPayment);
  const [paymentErrors, setPaymentErrors] = useState<Record<string, string>>({});
  const [reversing, setReversing] = useState<Payment | null>(null);
  const [reversalReason, setReversalReason] = useState("");
  const [reversalError, setReversalError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: "10" });
      if (q) params.set("q", q);
      if (tab === "charges") setCharges(await api.get<ListResponse<Charge>>(`/finance/charges?${params}`));
      else setPayments(await api.get<ListResponse<Payment>>(`/finance/payments?${params}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load finance data");
    } finally {
      setLoading(false);
    }
  }, [tab, q, page]);

  useEffect(() => {
    api.get<ListResponse<StudentOption>>("/students?pageSize=100&status=active")
      .then((r) => setStudents(r.data))
      .catch(() => setStudents([]));
  }, []);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const saveCharge = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setChargeErrors({});
    try {
      await api.post("/finance/charges", {
        ...chargeForm,
        studentId: Number(chargeForm.studentId),
      });
      setChargeModal(false);
      setChargeForm(emptyCharge);
      setTab("charges");
      setPage(1);
      load();
    } catch (err) {
      if (err instanceof ApiClientError && err.details) setChargeErrors(err.details);
    } finally {
      setSaving(false);
    }
  };

  const savePayment = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setPaymentErrors({});
    try {
      await api.post("/finance/payments", {
        ...paymentForm,
        studentId: Number(paymentForm.studentId),
      });
      setPaymentModal(false);
      setPaymentForm(emptyPayment);
      setTab("payments");
      setPage(1);
      load();
    } catch (err) {
      if (err instanceof ApiClientError && err.details) setPaymentErrors(err.details);
      setError(err instanceof ApiClientError ? err.message : "Payment failed");
    } finally {
      setSaving(false);
    }
  };

  const reverse = async () => {
    if (!reversing) return;
    setReversalError(null);
    try {
      await api.post(`/finance/payments/${reversing.id}/reverse`, { reason: reversalReason });
      setReversing(null);
      setReversalReason("");
      load();
    } catch (err) {
      setReversalError(err instanceof Error ? err.message : "Reversal failed");
    }
  };

  const studentLabel = (s: StudentOption) => `${s.firstName} ${s.lastName} · ${s.studentNumber}`;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Finance"
        subtitle="Fee charges, payments and reversals"
        actions={
          tab === "charges" ? (
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                setChargeForm(emptyCharge);
                setChargeErrors({});
                setChargeModal(true);
              }}
            >
              + New charge
            </button>
          ) : (
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                setPaymentForm(emptyPayment);
                setPaymentErrors({});
                setPaymentModal(true);
              }}
            >
              + Record payment
            </button>
          )
        }
      />

      {error && <ErrorBanner message={error} onClose={() => setError(null)} />}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-gray-200 bg-white p-0.5 text-sm shadow-card" role="tablist">
          <button
            type="button"
            className={`rounded-md px-3 py-1.5 font-medium ${tab === "payments" ? "bg-primary-600 text-white" : "text-gray-600 hover:bg-gray-100"}`}
            onClick={() => {
              setTab("payments");
              setPage(1);
            }}
            role="tab"
            aria-selected={tab === "payments"}
          >
            Payments
          </button>
          <button
            type="button"
            className={`rounded-md px-3 py-1.5 font-medium ${tab === "charges" ? "bg-primary-600 text-white" : "text-gray-600 hover:bg-gray-100"}`}
            onClick={() => {
              setTab("charges");
              setPage(1);
            }}
            role="tab"
            aria-selected={tab === "charges"}
          >
            Charges
          </button>
        </div>
        <input
          className="input max-w-xs"
          placeholder="Search reference, student…"
          aria-label="Search finance records"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
        />
      </div>

      {loading && !(tab === "charges" ? charges : payments) ? (
        <Spinner />
      ) : tab === "charges" ? (
        charges && charges.data.length > 0 ? (
          <>
            <div className="table-wrap">
              <table className="w-full">
                <thead className="border-b border-gray-100 bg-gray-50/60">
                  <tr>
                    <th className="th">Charge</th>
                    <th className="th">Student</th>
                    <th className="th">Description</th>
                    <th className="th">Date</th>
                    <th className="th text-right">Amount</th>
                    <th className="th text-right">Open</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {charges.data.map((c) => (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="td font-medium">{c.chargeNumber}</td>
                      <td className="td text-gray-600">
                        {c.firstName} {c.lastName}{" "}
                        <span className="text-xs text-gray-400">{c.studentNumber}</span>
                      </td>
                      <td className="td text-gray-600">
                        {c.description}{" "}
                        <span className="text-xs capitalize text-gray-400">{c.category}</span>
                      </td>
                      <td className="td text-gray-600">{formatDate(c.chargeDate)}</td>
                      <td className="td text-right">{formatMoney(c.amountCents)}</td>
                      <td className={`td text-right font-medium ${c.openCents > 0 ? "text-red-600" : ""}`}>
                        {formatMoney(c.openCents)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={charges.page} totalPages={charges.totalPages} onPage={setPage} />
          </>
        ) : (
          <div className="card">
            <EmptyState title="No charges recorded" hint="Create a charge to bill a student." />
          </div>
        )
      ) : payments && payments.data.length > 0 ? (
        <>
          <div className="table-wrap">
            <table className="w-full">
              <thead className="border-b border-gray-100 bg-gray-50/60">
                <tr>
                  <th className="th">Payment</th>
                  <th className="th">Student</th>
                  <th className="th">Method</th>
                  <th className="th">Reference</th>
                  <th className="th">Date</th>
                  <th className="th text-right">Amount</th>
                  <th className="th">Status</th>
                  <th className="th text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {payments.data.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="td font-medium">
                      {p.paymentNumber}
                      {p.note && <span className="ml-2 text-xs text-gray-400">{p.note}</span>}
                    </td>
                    <td className="td text-gray-600">
                      {p.firstName} {p.lastName} <span className="text-xs text-gray-400">{p.studentNumber}</span>
                    </td>
                    <td className="td text-gray-600 capitalize">{p.method.replace("_", " ")}</td>
                    <td className="td text-gray-600">{p.reference || "—"}</td>
                    <td className="td text-gray-600">{formatDate(p.paymentDate)}</td>
                    <td className="td text-right font-medium">{formatMoney(p.amountCents)}</td>
                    <td className="td">
                      <ReversedBadge isReversed={p.isReversed} />
                    </td>
                    <td className="td text-right">
                      {!p.isReversed && (
                        <button
                          type="button"
                          className="btn-secondary !px-2 !py-1 text-xs text-red-600"
                          onClick={() => {
                            setReversing(p);
                            setReversalReason("");
                            setReversalError(null);
                          }}
                        >
                          Reverse
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={payments.page} totalPages={payments.totalPages} onPage={setPage} />
        </>
      ) : (
        <div className="card">
          <EmptyState title="No payments recorded" hint="Record a payment against a student's fees." />
        </div>
      )}

      {/* New charge modal */}
      <Modal open={chargeModal} title="New fee charge" onClose={() => setChargeModal(false)} wide>
        <form className="grid grid-cols-1 gap-3 sm:grid-cols-2" onSubmit={saveCharge} noValidate>
          <Field label="Student" error={chargeErrors.studentId}>
            <select className="input" value={chargeForm.studentId} onChange={(e) => setChargeForm({ ...chargeForm, studentId: e.target.value })} required>
              <option value="">Select active student…</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {studentLabel(s)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Category" error={chargeErrors.category}>
            <select className="input" value={chargeForm.category} onChange={(e) => setChargeForm({ ...chargeForm, category: e.target.value })}>
              <option value="tuition">Tuition</option>
              <option value="accommodation">Accommodation</option>
              <option value="library">Library</option>
              <option value="registration">Registration</option>
              <option value="other">Other</option>
            </select>
          </Field>
          <div className="sm:col-span-2">
            <Field label="Description" error={chargeErrors.description}>
              <input className="input" placeholder="e.g. Semester tuition fee" value={chargeForm.description} onChange={(e) => setChargeForm({ ...chargeForm, description: e.target.value })} required />
            </Field>
          </div>
          <Field label="Amount" error={chargeErrors.amount} hint="Decimal with 2 places, e.g. 9500.00">
            <input className="input" inputMode="decimal" value={chargeForm.amount} onChange={(e) => setChargeForm({ ...chargeForm, amount: e.target.value })} required />
          </Field>
          <Field label="Charge date" error={chargeErrors.chargeDate}>
            <input className="input" type="date" value={chargeForm.chargeDate} onChange={(e) => setChargeForm({ ...chargeForm, chargeDate: e.target.value })} required />
          </Field>
          <div className="col-span-full mt-2 flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => setChargeModal(false)}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? "Saving…" : "Create charge"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Record payment modal */}
      <Modal open={paymentModal} title="Record payment" onClose={() => setPaymentModal(false)} wide>
        <form className="grid grid-cols-1 gap-3 sm:grid-cols-2" onSubmit={savePayment} noValidate>
          <Field label="Student" error={paymentErrors.studentId}>
            <select className="input" value={paymentForm.studentId} onChange={(e) => setPaymentForm({ ...paymentForm, studentId: e.target.value })} required>
              <option value="">Select active student…</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {studentLabel(s)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Amount" error={paymentErrors.amount} hint="Allocated to open charges, oldest first">
            <input className="input" inputMode="decimal" value={paymentForm.amount} onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })} required />
          </Field>
          <Field label="Method" error={paymentErrors.method}>
            <select className="input" value={paymentForm.method} onChange={(e) => setPaymentForm({ ...paymentForm, method: e.target.value })}>
              <option value="cash">Cash</option>
              <option value="bank_transfer">Bank transfer</option>
              <option value="card">Card</option>
              <option value="mobile_money">Mobile money</option>
              <option value="cheque">Cheque</option>
            </select>
          </Field>
          <Field label="Reference" error={paymentErrors.reference} hint="e.g. bank reference number">
            <input className="input" value={paymentForm.reference} onChange={(e) => setPaymentForm({ ...paymentForm, reference: e.target.value })} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Note" error={paymentErrors.note}>
              <input className="input" value={paymentForm.note} onChange={(e) => setPaymentForm({ ...paymentForm, note: e.target.value })} />
            </Field>
          </div>
          <Field label="Payment date" error={paymentErrors.paymentDate}>
            <input className="input" type="date" value={paymentForm.paymentDate} onChange={(e) => setPaymentForm({ ...paymentForm, paymentDate: e.target.value })} required />
          </Field>
          <div className="col-span-full mt-2 flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => setPaymentModal(false)}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? "Recording…" : "Record payment"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Reversal confirm */}
      <ConfirmDialog
        open={reversing !== null}
        title="Reverse payment"
        message={`${reversing?.paymentNumber} (${formatMoney(reversing?.amountCents ?? 0)}) will be reversed. The payment is kept for audit; balances update immediately.`}
        confirmLabel="Reverse payment"
        dangerous
        onCancel={() => setReversing(null)}
        onConfirm={reverse}
      >
        <div className="mt-3">
          <Field label="Reason (required for audit)" error={reversalError ?? undefined}>
            <textarea
              className="input min-h-20"
              value={reversalReason}
              onChange={(e) => setReversalReason(e.target.value)}
              placeholder="Explain why this payment is being reversed"
              minLength={5}
              required
            />
          </Field>
        </div>
      </ConfirmDialog>
    </div>
  );
}
