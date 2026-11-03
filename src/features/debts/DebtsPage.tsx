import {
  ChevronRight,
  Clock,
  CreditCard,
  History,
  ListChecks,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
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
import { EmptyState } from '../../ui/EmptyState';
import { Modal } from '../../ui/Modal';
import { PageHeader } from '../../ui/PageHeader';
import { Metric, Stat } from '../../ui/Stat';
import ui from '../../ui/ui.module.css';
import { useIsPhone } from '../../ui/useIsPhone';
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

/** A phone tile keeps the main figures. Everything else opens in LoanDetails. */
function LoanCard({ summary, onOpen }: { summary: LoanSummary; onOpen: () => void }) {
  const { type, member, ledger, error } = summary;
  const active = (ledger?.remaining ?? 0) > 0;
  const paid = ledger ? paidShare(ledger) : 0;
  return (
    <button className={ui.categoryCard} onClick={onOpen} type="button">
      <div className={ui.split}>
        <div>
          <div style={{ fontWeight: 600 }}>
            <span className={ui.visuallyHidden}>Open </span>
            {type}
          </div>
          <div className={ui.caption}>{member}</div>
        </div>
        <span className={ui.tableActions} style={{ alignItems: 'center' }}>
          <span className={active ? ui.badge : ui.badgeDone}>{active ? 'Active' : 'Paid off'}</span>
          <ChevronRight aria-hidden="true" size={16} />
        </span>
      </div>
      {ledger ? (
        <>
          <div className={ui.compact}>
            <Metric label="Remaining" value={formatMoney(ledger.remaining)} />
            <Metric label="EMI" value={formatMoney(ledger.emi)} />
            <Metric label="Interest rate" value={`${ledger.rate}%`} />
            <Metric label="EMIs left (est.)" value={String(remainingEmis(ledger) ?? '—')} />
          </div>
          <div className={ui.meter} style={{ height: 5, margin: '4px 0' }}>
            <span className={ui.meterFill} style={{ width: `${paid * 100}%` }} />
          </div>
          <span className={`${ui.caption} ${ui.gain}`}>{formatPercent(paid)} paid</span>
        </>
      ) : (
        <span className={ui.fieldError}>{error}</span>
      )}
    </button>
  );
}

function LoanDetails({
  summary,
  onClose,
  onHistory,
  onEdit,
  onDelete,
}: {
  summary: LoanSummary;
  onClose: () => void;
  onHistory: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { type, ledger } = summary;
  return (
    <Modal onClose={onClose} title={type}>
      <div className={ui.page}>
        {ledger ? (
          <div className={ui.metrics} style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
            <Metric label="Remaining principal" value={formatMoney(ledger.remaining)} />
            <Metric label="EMI" value={formatMoney(ledger.emi)} />
            <Metric label="Total borrowed" value={formatMoney(ledger.totalPrincipal)} />
            <Metric label="Rate" value={`${ledger.rate}%`} />
            <Metric label="Remaining EMIs (est.)" value={String(remainingEmis(ledger) ?? '—')} />
            <Metric label="Interest paid" value={formatMoney(ledger.interestPaid)} />
          </div>
        ) : null}
        <div className={ui.actions}>
          <button className={ui.quiet} onClick={onHistory} type="button">
            <History size={14} /> History
          </button>
          <button className={ui.quiet} onClick={onEdit} type="button">
            <Pencil size={14} /> Edit
          </button>
          <button className={ui.quiet} onClick={onDelete} type="button">
            <Trash2 size={14} /> Delete
          </button>
        </div>
      </div>
    </Modal>
  );
}

export function DebtsPage() {
  const data = useView();
  const commit = useTracker((state) => state.commit);
  const today = localDate();
  const { state: quickAdd } = useLocation() as {
    state: { add?: boolean; loan?: string } | null;
  };
  const [adding, setAdding] = useState(quickAdd?.add === true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const phone = useIsPhone();
  const chosen = quickAdd?.loan ?? null;
  const [historyId, setHistoryId] = useState<string | null>(phone ? null : chosen);
  const [detailsId, setDetailsId] = useState<string | null>(phone ? chosen : null);
  const summaries = summarizeLoans(data, today);
  const { sorted, sort, toggle } = useSort(summaries, loanSortValue);
  const editing = data.loans.find((loan) => loan.id === editingId);
  const history = data.loans.find((loan) => loan.id === historyId);
  const details = summaries.find((summary) => summary.id === detailsId);
  const detailsLoan = data.loans.find((loan) => loan.id === detailsId);

  const remove = (loan: Loan) => {
    if (!window.confirm(`Delete ${loan.type} and its EMI payment records?`)) return;
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
          <EmptyState
            action={
              <button className={ui.quiet} onClick={() => setAdding(true)} type="button">
                Add your first loan
              </button>
            }
            icon={CreditCard}
            text="Add a loan to follow its balance, EMIs and interest."
            title="No loans recorded yet."
          />
        ) : phone ? (
          <div className={ui.threeColumn}>
            {sorted.map((summary) => (
              <LoanCard
                key={summary.id}
                onOpen={() => setDetailsId(summary.id)}
                summary={summary}
              />
            ))}
          </div>
        ) : (
          <div aria-label="Scrollable table" className={ui.tableWrap} role="group" tabIndex={0}>
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
                            data-tip="View history"
                          >
                            <History size={14} />
                          </button>
                          <button
                            aria-label={`Edit ${type}`}
                            className={ui.smallIcon}
                            onClick={() => setEditingId(id)}
                            type="button"
                            data-tip="Edit"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            aria-label={`Delete ${type}`}
                            className={ui.smallIcon}
                            onClick={() => loan && remove(loan)}
                            type="button"
                            data-tip="Delete"
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
      {details && detailsLoan ? (
        <LoanDetails
          onClose={() => setDetailsId(null)}
          onDelete={() => {
            setDetailsId(null);
            remove(detailsLoan);
          }}
          onEdit={() => {
            setDetailsId(null);
            setEditingId(details.id);
          }}
          onHistory={() => {
            setDetailsId(null);
            setHistoryId(details.id);
          }}
          summary={details}
        />
      ) : null}
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
