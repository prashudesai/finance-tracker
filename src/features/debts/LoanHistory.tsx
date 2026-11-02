import { FileText, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import {
  dailyStatement,
  isLoanFailure,
  paymentBalances,
  quotePayment,
  rebuildLoan,
} from '../../domain/loan';
import { loanPayments } from '../../domain/recurring';
import { EMI_CATEGORY, type Expense, type Loan, type LoanChange } from '../../schema/records';
import { useTracker } from '../../store/tracker';
import { Field } from '../../ui/Field';
import { formatDay, formatMoney, localDate } from '../../ui/format';
import { Modal } from '../../ui/Modal';
import { downloadTablePdf, pdfAmount } from '../../ui/pdf';
import ui from '../../ui/ui.module.css';

type Entry = 'payment' | 'part-payment' | 'rate' | 'topup' | 'emi';

const ENTRY_LABELS: Record<Entry, string> = {
  payment: 'EMI payment',
  'part-payment': 'Part payment',
  rate: 'Rate change',
  topup: 'Top-up',
  emi: 'Revised EMI',
};

function EntryForm({ loan, onDone }: { loan: Loan; onDone: () => void }) {
  const expenses = useTracker((state) => state.data.expenses);
  const commit = useTracker((state) => state.commit);
  const [entry, setEntry] = useState<Entry>('payment');
  const [date, setDate] = useState(localDate());
  const [amount, setAmount] = useState('');
  const [choice, setChoice] = useState<'tenure' | 'emi'>('tenure');
  const [action, setAction] = useState<'keep' | 'reduce'>('keep');
  const [error, setError] = useState('');
  const value = Number(amount);
  const payments = loanPayments(expenses, loan.id);
  const needsAmount = entry !== 'payment';

  const label =
    entry === 'rate' ? 'New interest rate (%)' : entry === 'emi' ? 'New EMI (₹)' : 'Amount (₹)';

  const submit = () => {
    setError('');
    const asOf = date > localDate() ? date : localDate();
    if (entry === 'payment' || entry === 'part-payment') {
      let paid = value;
      if (entry === 'payment') {
        const quote = quotePayment(loan, payments, date);
        if (isLoanFailure(quote)) {
          setError(quote.error);
          return;
        }
        if (quote.paidOff) {
          setError('This loan is already paid off.');
          return;
        }
        paid = quote.amount;
      }
      const id = crypto.randomUUID();
      const row: Expense = {
        id,
        date,
        category: EMI_CATEGORY,
        subcategory: '',
        isAnnual: false,
        loanId: loan.id,
        amount: paid,
        repaymentType: entry === 'payment' ? 'emi' : 'part-payment',
        ...(entry === 'part-payment' ? { partPaymentAction: action } : {}),
      };
      const check = rebuildLoan(loan, [...payments, row], { asOf });
      if (isLoanFailure(check)) {
        setError(check.error);
        return;
      }
      commit([{ type: 'set', collection: 'expenses', id, value: row }]);
      onDone();
      return;
    }
    const base = { id: crypto.randomUUID(), date, type: entry };
    let change: LoanChange;
    if (entry === 'rate') change = { ...base, rate: value, repaymentChoice: choice };
    else if (entry === 'topup') change = { ...base, amount: value, repaymentChoice: choice };
    else change = { ...base, emi: value, repaymentChoice: 'manual' };
    const next = { ...loan, changes: [...loan.changes, change] };
    const check = rebuildLoan(next, payments, { asOf });
    if (isLoanFailure(check)) {
      setError(check.error);
      return;
    }
    commit([{ type: 'set', collection: 'loans', id: loan.id, value: next }]);
    onDone();
  };

  return (
    <form
      className={ui.form}
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <Field label="Add">
        <select onChange={(event) => setEntry(event.target.value as Entry)} value={entry}>
          {Object.entries(ENTRY_LABELS).map(([key, text]) => (
            <option key={key} value={key}>
              {text}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Date">
        <input onChange={(event) => setDate(event.target.value)} type="date" value={date} />
      </Field>
      {needsAmount ? (
        <Field label={label}>
          <input
            inputMode="decimal"
            onChange={(event) => setAmount(event.target.value)}
            step="0.01"
            type="number"
            value={amount}
          />
        </Field>
      ) : null}
      {entry === 'part-payment' ? (
        <Field label="After this payment">
          <select
            onChange={(event) => setAction(event.target.value as 'keep' | 'reduce')}
            value={action}
          >
            <option value="keep">Keep EMI, shorten tenure</option>
            <option value="reduce">Reduce EMI</option>
          </select>
        </Field>
      ) : null}
      {entry === 'rate' || entry === 'topup' ? (
        <Field label="Repayment">
          <select
            onChange={(event) => setChoice(event.target.value as 'tenure' | 'emi')}
            value={choice}
          >
            <option value="tenure">Keep remaining tenure</option>
            <option value="emi">Keep EMI</option>
          </select>
        </Field>
      ) : null}
      {error ? (
        <p className={ui.fieldError} role="alert" style={{ gridColumn: '1 / -1', margin: 0 }}>
          {error}
        </p>
      ) : null}
      <div className={ui.formActions}>
        <button
          className={ui.button}
          disabled={needsAmount && !(value > 0 || (entry === 'rate' && amount !== ''))}
          type="submit"
        >
          Save {ENTRY_LABELS[entry].toLowerCase()}
        </button>
      </div>
    </form>
  );
}

/** Uses the bank's interest for one EMI. Later balances replay from it. */
function SplitCorrection({
  loan,
  payment,
  payments,
  onDone,
}: {
  loan: Loan;
  payment: Expense;
  payments: Expense[];
  onDone: () => void;
}) {
  const commit = useTracker((state) => state.commit);
  const [interest, setInterest] = useState(String(payment.interestPaid ?? ''));
  const [error, setError] = useState('');
  const value = Number(interest);
  const valid = interest !== '' && value >= 0;
  const corrected: Expense = { ...payment, interestOverride: true, interestPaid: value };
  const plain = { ...payment };
  delete plain.interestOverride;
  delete plain.interestPaid;

  const save = (row: Expense) => {
    const next = payments.map((item) => (item.id === row.id ? row : item));
    const check = rebuildLoan(loan, next, { asOf: localDate() });
    if (isLoanFailure(check)) {
      setError(check.error);
      return;
    }
    commit([{ type: 'set', collection: 'expenses', id: row.id, value: row }]);
    onDone();
  };

  return (
    <form
      className={ui.form}
      onSubmit={(event) => {
        event.preventDefault();
        if (valid) save(corrected);
      }}
    >
      <p className={ui.caption} style={{ gridColumn: '1 / -1', margin: 0 }}>
        Enter the interest from your bank statement for this {formatMoney(payment.amount)} EMI on{' '}
        {payment.date}. The rest counts as principal, and later balances update.
      </p>
      <Field label="Interest on statement (₹)">
        <input
          inputMode="decimal"
          onChange={(event) => setInterest(event.target.value)}
          step="0.01"
          type="number"
          value={interest}
        />
      </Field>
      {error ? (
        <p className={ui.fieldError} role="alert" style={{ gridColumn: '1 / -1', margin: 0 }}>
          {error}
        </p>
      ) : null}
      <div className={ui.formActions}>
        {payment.interestOverride ? (
          <button className={ui.quiet} onClick={() => save(plain)} type="button">
            Use calculated interest
          </button>
        ) : null}
        <button className={ui.button} disabled={!valid} type="submit">
          Save correction
        </button>
      </div>
    </form>
  );
}

export function LoanHistory({ loan, onClose }: { loan: Loan; onClose: () => void }) {
  const expenses = useTracker((state) => state.data.expenses);
  const commit = useTracker((state) => state.commit);
  const report = useTracker((state) => state.report);
  const [correcting, setCorrecting] = useState<Expense | null>(null);
  const today = localDate();
  const payments = loanPayments(expenses, loan.id);
  const ledger = rebuildLoan(loan, payments, { asOf: today });
  const balances = paymentBalances(loan, payments, today);
  const statement = loan.dailyInterestBasis ? dailyStatement(loan, payments, today) : null;
  const splits = isLoanFailure(ledger)
    ? new Map<string, { principalPaid: number; interestPaid: number }>()
    : new Map(ledger.payments.map((row) => [row.id, row]));
  const after = isLoanFailure(balances) ? new Map<string, number>() : balances.balances;
  const newest = [...payments].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <Modal onClose={onClose} title={`${loan.type} history`}>
      <div className={ui.page}>
        <EntryForm
          key={payments.length + loan.changes.length}
          loan={loan}
          onDone={() => undefined}
        />
        {newest.length > 0 ? (
          <div className={ui.formActions}>
            <button
              className={ui.quiet}
              onClick={() =>
                void downloadTablePdf({
                  title: `${loan.type} Payment History`,
                  subtitle: `Oldest to newest · Generated ${today} · Amounts in INR`,
                  columns: [
                    { label: 'Date', width: 30 },
                    { label: 'Entry', width: 45 },
                    { label: 'Paid', width: 50, numeric: true },
                    { label: 'Interest', width: 50, numeric: true },
                    { label: 'Principal', width: 50, numeric: true },
                    { label: 'Balance', width: 50, numeric: true },
                  ],
                  rows: [...newest]
                    .reverse()
                    .map((row) => [
                      row.date,
                      row.repaymentType === 'part-payment' ? 'Part payment' : 'EMI payment',
                      pdfAmount(row.amount),
                      pdfAmount(splits.get(row.id)?.interestPaid ?? 0),
                      pdfAmount(splits.get(row.id)?.principalPaid ?? 0),
                      pdfAmount(after.get(row.id) ?? 0),
                    ]),
                  file: `${loan.type.toLowerCase().replaceAll(' ', '-')}-history.pdf`,
                }).catch(() => report('The PDF could not be created. Please try again.'))
              }
              type="button"
            >
              <FileText size={16} /> Save PDF
            </button>
          </div>
        ) : null}
        {isLoanFailure(ledger) ? (
          <p className={ui.fieldError} role="alert">
            {ledger.error}
          </p>
        ) : null}
        {loan.changes.length > 0 ? (
          <div>
            <div className={ui.groupLabel}>Rate and term changes</div>
            <ul className={ui.list}>
              {loan.changes.map((change) => (
                <li className={ui.row} key={change.id}>
                  <div className={ui.rowMain}>
                    <div className={ui.rowTitle}>{ENTRY_LABELS[change.type]}</div>
                    <div className={ui.rowDetail}>
                      {change.date}
                      {change.rate === undefined ? '' : ` · ${change.rate}%`}
                      {change.amount === undefined ? '' : ` · ${formatMoney(change.amount)}`}
                      {change.emi === undefined ? '' : ` · EMI ${formatMoney(change.emi)}`}
                    </div>
                  </div>
                  <button
                    aria-label={`Delete change of ${change.date}`}
                    className={ui.smallIcon}
                    onClick={() =>
                      commit([
                        {
                          type: 'set',
                          collection: 'loans',
                          id: loan.id,
                          value: {
                            ...loan,
                            changes: loan.changes.filter((row) => row.id !== change.id),
                          },
                        },
                      ])
                    }
                    type="button"
                  >
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <div>
          <div className={ui.groupLabel}>Payments</div>
          {newest.length === 0 ? (
            <p className={ui.empty}>No payments recorded yet.</p>
          ) : (
            <div aria-label="Scrollable table" className={ui.tableWrap} role="group" tabIndex={0}>
              <table className={ui.table}>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th className={ui.numeric}>Paid</th>
                    <th className={ui.numeric}>Principal</th>
                    <th className={ui.numeric}>Interest</th>
                    <th className={ui.numeric}>Balance</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {newest.map((row) => (
                    <tr key={row.id}>
                      <td>
                        {formatDay(row.date)} {row.date.slice(0, 4)}
                      </td>
                      <td className={ui.numeric}>{formatMoney(row.amount)}</td>
                      <td className={ui.numeric}>
                        {formatMoney(splits.get(row.id)?.principalPaid ?? 0)}
                      </td>
                      <td className={ui.numeric}>
                        {formatMoney(splits.get(row.id)?.interestPaid ?? 0)}
                      </td>
                      <td className={ui.numeric}>{formatMoney(after.get(row.id) ?? 0)}</td>
                      <td>
                        <button
                          aria-label={`Correct interest of ${row.date}`}
                          className={ui.smallIcon}
                          onClick={() => setCorrecting(row)}
                          type="button"
                          data-tip="Correct interest"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          aria-label={`Delete payment of ${row.date}`}
                          className={ui.smallIcon}
                          onClick={() =>
                            commit([{ type: 'delete', collection: 'expenses', id: row.id }])
                          }
                          type="button"
                          data-tip="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        {statement && !isLoanFailure(statement) ? (
          <details className={ui.fold}>
            <summary>Daily-balance statement</summary>
            <ul className={ui.list}>
              {statement.rows.map((row, index) => (
                <li className={ui.row} key={`${row.date}-${index}`}>
                  <div className={ui.rowMain}>
                    <div className={ui.rowTitle}>{row.type}</div>
                    <div className={ui.rowDetail}>
                      {row.date} · {row.description}
                    </div>
                  </div>
                  <span className={ui.amount}>{formatMoney(row.balance)}</span>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </div>
      {correcting ? (
        <Modal onClose={() => setCorrecting(null)} title="Correct EMI split">
          <SplitCorrection
            loan={loan}
            onDone={() => setCorrecting(null)}
            payment={correcting}
            payments={payments}
          />
        </Modal>
      ) : null}
    </Modal>
  );
}
