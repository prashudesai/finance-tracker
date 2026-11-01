import { Clock, CreditCard, History, ListChecks, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useLocation } from 'react-router';
import { loanPayments, stopSchedules } from '../../domain/recurring';
import {
  paidShare,
  remainingEmis,
  summarizeLoans,
  totalMonthlyEmi,
  totalOutstanding,
  type LoanSummary,
} from '../../domain/summary';
import type { RecordWrite } from '../../data/repository';
import type { Loan } from '../../schema/records';
import { useTracker, useView } from '../../store/tracker';
import { formatMoney, formatPercent, localDate } from '../../ui/format';
import { Modal } from '../../ui/Modal';
import { PageHeader } from '../../ui/PageHeader';
import { Stat } from '../../ui/Stat';
import ui from '../../ui/ui.module.css';
import { SortHeader, useSort } from '../../ui/useSort';
import { LoanForm } from './LoanForm';
import { LoanHistory } from './LoanHistory';

type LoanColumn = 'type' | 'borrowed' | 'rate' | 'emi' | 'remaining' | 'emis' | 'status';

function loanSortValue({ type, ledger }: LoanSummary, column: LoanColumn) {
  if (column === 'type') return type;
  if (column === 'borrowed') return ledger?.totalPrincipal ?? 0;
  if (column === 'rate') return ledger?.rate ?? 0;
  if (column === 'emi') return ledger?.emi ?? 0;
  if (column === 'remaining') return ledger?.remaining ?? 0;
  if (column === 'emis') return (ledger ? remainingEmis(ledger) : null) ?? 0;
  return (ledger?.remaining ?? 0) > 0 ? 'Active' : 'Paid off';
}

export function DebtsPage() {
  const data = useView();
  const commit = useTracker((state) => state.commit);
  const today = localDate();
  const { state: quickAdd } = useLocation() as { state: { add?: boolean } | null };
  const [adding, setAdding] = useState(quickAdd?.add === true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [historyId, setHistoryId] = useState<string | null>(null);
  const summaries = summarizeLoans(data, today);
  const { sorted, sort, toggle } = useSort(summaries, loanSortValue);
  const editing = data.loans.find((loan) => loan.id === editingId);
  const history = data.loans.find((loan) => loan.id === historyId);

  const remove = (loan: Loan) => {
    const stopped = stopSchedules(
      {
        rules: data.recurringRules,
        occurrences: data.recurringOccurrences,
        income: data.income,
        expenses: data.expenses,
        loans: data.loans,
      },
      (rule) => rule.kind === 'emi' && rule.loanId === loan.id,
      today.slice(0, 7),
    );
    const kept = new Set(stopped.rules.map((rule) => rule.id));
    const writes: RecordWrite[] = [
      { type: 'delete', collection: 'loans', id: loan.id },
      ...loanPayments(data.expenses, loan.id).map((row): RecordWrite => ({
        type: 'delete',
        collection: 'expenses',
        id: row.id,
      })),
      ...data.recurringRules
        .filter((rule) => rule.kind === 'emi' && rule.loanId === loan.id)
        .map((rule): RecordWrite =>
          kept.has(rule.id)
            ? {
                type: 'set',
                collection: 'recurringRules',
                id: rule.id,
                value: stopped.rules.find((row) => row.id === rule.id) ?? rule,
              }
            : { type: 'delete', collection: 'recurringRules', id: rule.id },
        ),
    ];
    commit(writes);
  };

  return (
    <div className={ui.page}>
      <PageHeader
        eyebrow="Borrowing"
        subtitle="See what remains, monitor monthly commitments, and review repayments."
        title="Debt & EMI Tracker"
      />
      <section aria-label="Debt totals" className={ui.tiles}>
        <Stat
          icon={CreditCard}
          label="Outstanding balance"
          value={formatMoney(totalOutstanding(summaries))}
        />
        <Stat
          icon={Clock}
          label="Active monthly EMI"
          value={formatMoney(totalMonthlyEmi(summaries))}
        />
      </section>
      <section className={ui.card}>
        <div className={ui.cardHeader}>
          <div className={ui.cardHeader} style={{ justifyContent: 'flex-start' }}>
            <span aria-hidden="true" className={ui.tileIcon}>
              <ListChecks size={20} />
            </span>
            <div>
              <h2 style={{ fontSize: '1.2rem' }}>Loan Summary</h2>
              <div className={ui.caption}>Outstanding balances and recorded EMI history</div>
            </div>
          </div>
          <button className={ui.button} onClick={() => setAdding(true)} type="button">
            <Plus size={16} /> Add Loan
          </button>
        </div>
        {summaries.length === 0 ? (
          <p className={ui.empty}>No loans recorded yet.</p>
        ) : (
          <div className={ui.tableWrap}>
            <table className={ui.table}>
              <thead>
                <tr>
                  <SortHeader column="type" label="Type" onSort={toggle} sort={sort} />
                  <SortHeader
                    column="borrowed"
                    label="Total borrowed"
                    numeric
                    onSort={toggle}
                    sort={sort}
                  />
                  <SortHeader column="rate" label="Rate" numeric onSort={toggle} sort={sort} />
                  <SortHeader column="emi" label="EMI" numeric onSort={toggle} sort={sort} />
                  <SortHeader
                    column="remaining"
                    label="Remaining principal"
                    numeric
                    onSort={toggle}
                    sort={sort}
                  />
                  <SortHeader
                    column="emis"
                    label="Remaining EMIs (est.)"
                    numeric
                    onSort={toggle}
                    sort={sort}
                  />
                  <SortHeader column="status" label="Status" onSort={toggle} sort={sort} />
                  <th className={ui.numeric}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map(({ id, type, member, ledger, error }) => {
                  const loan = data.loans.find((row) => row.id === id);
                  const paid = ledger ? paidShare(ledger) : 0;
                  const active = (ledger?.remaining ?? 0) > 0;
                  return (
                    <tr key={id}>
                      <td>
                        <strong>{type}</strong>
                        <div className={ui.caption}>{member}</div>
                      </td>
                      <td className={ui.numeric}>
                        {ledger ? formatMoney(ledger.totalPrincipal) : '—'}
                      </td>
                      <td className={ui.numeric}>{ledger ? `${ledger.rate}%` : '—'}</td>
                      <td className={ui.numeric}>{ledger ? formatMoney(ledger.emi) : '—'}</td>
                      <td className={ui.numeric} style={{ minWidth: 200 }}>
                        {ledger ? (
                          <>
                            <strong>{formatMoney(ledger.remaining)}</strong>
                            <div className={ui.meter} style={{ height: 5, margin: '4px 0' }}>
                              <span className={ui.meterFill} style={{ width: `${paid * 100}%` }} />
                            </div>
                            <span className={`${ui.caption} ${ui.gain}`}>
                              {formatPercent(paid)} paid | Interest:{' '}
                              {formatMoney(ledger.interestPaid)}
                            </span>
                          </>
                        ) : (
                          <span className={ui.fieldError}>{error}</span>
                        )}
                      </td>
                      <td className={ui.numeric}>
                        {ledger ? (remainingEmis(ledger) ?? '—') : '—'}
                      </td>
                      <td>
                        <span className={active ? ui.badge : ui.badgeDone}>
                          {active ? 'Active' : 'Paid off'}
                        </span>
                      </td>
                      <td>
                        <div className={ui.tableActions}>
                          <button
                            aria-label={`History of ${type}`}
                            className={ui.smallIcon}
                            onClick={() => setHistoryId(id)}
                            type="button"
                          >
                            <History size={14} />
                          </button>
                          <button
                            aria-label={`Edit ${type}`}
                            className={ui.smallIcon}
                            onClick={() => setEditingId(id)}
                            type="button"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            aria-label={`Delete ${type}`}
                            className={ui.smallIcon}
                            onClick={() => loan && remove(loan)}
                            type="button"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {adding ? (
        <Modal onClose={() => setAdding(false)} title="Add Loan">
          <LoanForm onDone={() => setAdding(false)} />
        </Modal>
      ) : null}
      {editing ? (
        <Modal onClose={() => setEditingId(null)} title={`Edit ${editing.type}`}>
          <LoanForm initial={editing} onDone={() => setEditingId(null)} />
        </Modal>
      ) : null}
      {history ? <LoanHistory loan={history} onClose={() => setHistoryId(null)} /> : null}
    </div>
  );
}
