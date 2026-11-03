import { ArrowDownToLine, ArrowUpFromLine, TrendingUp } from 'lucide-react';
import { Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router';
import { isMonthEnd, monthsToReview } from '../../domain/analytics';
import { previousMonth } from '../../domain/calendar';
import { monthTotals } from '../../domain/cashflow';
import type { Expense, Income } from '../../schema/records';
import { useTracker, useView } from '../../store/tracker';
import { formatDay, formatMoney, formatMonth, localDate } from '../../ui/format';
import { CategoryLabel } from '../../ui/CategoryLabel';
import { Modal } from '../../ui/Modal';
import { PageHeader } from '../../ui/PageHeader';
import { Metric, Stat } from '../../ui/Stat';
import { scrollToSection } from '../../ui/scroll';
import { useIsPhone } from '../../ui/useIsPhone';
import ui from '../../ui/ui.module.css';
import { Commitments } from './Commitments';
import { ExpenseForm, IncomeForm } from './EntryForms';
import { HistoryTable, type Column } from './HistoryTable';
import { MonthlyBalances } from './MonthlyBalances';
import { MonthReview } from './MonthReview';

const MONTH_CHOICES = 24;

const INCOME_COLUMNS: Column<Income>[] = [
  { header: 'Member', secondary: true, cell: (row) => row.member, sortValue: (row) => row.member },
  {
    header: 'Source',
    cell: (row) => (
      <>
        <CategoryLabel income name={row.source} />
        <span className={`${ui.rowDetail} ${ui.showOnPhone}`}>{row.member}</span>
      </>
    ),
    sortValue: (row) => row.source,
  },
  {
    header: 'Amount',
    numeric: true,
    cell: (row) => formatMoney(row.amount),
    sortValue: (row) => row.amount,
  },
  {
    header: 'Date',
    cell: (row) => formatDay(row.date),
    detail: (row) => `${formatDay(row.date)} ${row.date.slice(0, 4)}`,
    sortValue: (row) => row.date,
  },
];

const noteDetails = (row: { notes?: string | undefined; recurringRuleId?: string | undefined }) => {
  const rows: [string, string][] = [];
  if (row.notes) rows.push(['Notes', row.notes]);
  if (row.recurringRuleId) rows.push(['Added by', 'Recurring schedule']);
  return rows;
};

function BalanceExplainer() {
  return (
    <details className={ui.fold}>
      <summary>How this balance is calculated</summary>
      <p className={ui.caption}>
        Income recorded this month, less expenses recorded this month, including EMIs. Opening bank
        balances aren't included. Family members' personal income follows the selected profile, and
        household expenses stay shared.
      </p>
    </details>
  );
}

export function CashFlowPage() {
  const data = useView();
  const household = useTracker((state) => state.data);
  const commit = useTracker((state) => state.commit);
  const current = localDate().slice(0, 7);
  const [month, setMonth] = useState(current);
  const [editingIncome, setEditingIncome] = useState<Income | null>(null);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [adding, setAdding] = useState<'income' | 'expense' | null>(null);
  const [history, setHistory] = useState<'income' | 'expense'>('income');
  const [reviewOpen, setReviewOpen] = useState(false);
  const phone = useIsPhone();
  const { state: quickAdd } = useLocation() as {
    state: {
      add?: 'income' | 'expense';
      review?: string;
      commitments?: boolean;
      found?: { kind: 'income' | 'expense'; id: string; month: string };
    } | null;
  };

  // The dashboard's add menu lands here with the entry to open.
  useEffect(() => {
    if (quickAdd?.add) {
      setHistory(quickAdd.add);
      setAdding(quickAdd.add);
    }
    if (quickAdd?.review) {
      setMonth(quickAdd.review);
      setReviewOpen(true);
      scrollToSection('month-review');
    }
    if (quickAdd?.commitments) scrollToSection('commitments');
    if (quickAdd?.found) {
      setMonth(quickAdd.found.month);
      setHistory(quickAdd.found.kind);
    }
  }, [quickAdd]);

  // A reviewed month leaves the screen: the next one opens, or the card closes.
  const nextReview = () => {
    const next = monthsToReview(household, localDate()).find((key) => key !== month);
    if (next) {
      setMonth(next);
      scrollToSection('month-review');
    } else {
      setReviewOpen(false);
    }
  };

  const today = localDate();
  const needsReview =
    monthsToReview(household, today).includes(month) && (month !== current || isMonthEnd(today));

  const loanName = (id: string | undefined) =>
    data.loans.find((loan) => loan.id === id)?.type ?? '';
  const expenseNote = (row: Expense) => loanName(row.loanId) || row.subcategory || row.notes || '—';
  const expenseColumns: Column<Expense>[] = [
    {
      header: 'Category',
      cell: (row) => <CategoryLabel name={row.category} />,
      sortValue: (row) => row.category,
    },
    {
      header: 'Amount',
      numeric: true,
      cell: (row) => formatMoney(row.amount),
      sortValue: (row) => row.amount,
    },
    {
      header: 'Type',
      secondary: true,
      cell: (row) => (row.isAnnual ? 'Annual' : 'Monthly'),
      sortValue: (row) => (row.isAnnual ? 'Annual' : 'Monthly'),
    },
    { header: 'Loan/Notes', secondary: true, cell: expenseNote, sortValue: expenseNote },
    {
      header: 'Date',
      cell: (row) => formatDay(row.date),
      detail: (row) => `${formatDay(row.date)} ${row.date.slice(0, 4)}`,
      sortValue: (row) => row.date,
    },
  ];
  const totals = monthTotals(data).get(month) ?? { income: 0, expenses: 0 };
  const newest = <Row extends { date: string }>(rows: Row[]) =>
    rows.filter((row) => row.date.startsWith(month)).sort((a, b) => b.date.localeCompare(a.date));
  const months = Array.from({ length: MONTH_CHOICES }).reduce<string[]>(
    (list) => [...list, previousMonth(list.at(-1) ?? current)],
    [current],
  );

  return (
    <div className={ui.page}>
      <PageHeader
        action={
          <select
            aria-label="Month"
            className={ui.fieldSelect}
            onChange={(event) => setMonth(event.target.value)}
            value={month}
          >
            {(months.includes(month) ? months : [...months, month]).map((key) => (
              <option key={key} value={key}>
                {formatMonth(key)}
              </option>
            ))}
          </select>
        }
        eyebrow="Your money at a glance"
        subtitle="Income, spending and what remains"
        title="Cash flow"
      />
      {needsReview ? (
        <button
          className={ui.primaryWide}
          onClick={() => {
            setReviewOpen(true);
            scrollToSection('month-review');
          }}
          type="button"
        >
          Review this month
        </button>
      ) : null}
      {phone ? (
        <section aria-label="Selected month" className={ui.card}>
          <div className={ui.metric}>
            <div className={ui.statLabel}>Balance after expenses</div>
            <div className={ui.value}>{formatMoney(totals.income - totals.expenses)}</div>
          </div>
          <div className={ui.metricsTwo}>
            <Metric label="Income recorded" value={formatMoney(totals.income)} />
            <Metric label="Expenses recorded" value={formatMoney(totals.expenses)} />
          </div>
          {totals.income > 0 ? (
            <div className={ui.meter}>
              <span
                className={ui.meterExpense}
                style={{ width: `${Math.min(1, totals.expenses / totals.income) * 100}%` }}
              />
            </div>
          ) : null}
          <div className={ui.caption}>
            {totals.income === 0 && totals.expenses === 0
              ? 'No income or expenses recorded for this month'
              : totals.expenses > totals.income
                ? 'Expenses are above income this month'
                : `${totals.income > 0 ? Math.round((totals.expenses / totals.income) * 100) : 0}% of income spent`}
          </div>
          <BalanceExplainer />
        </section>
      ) : (
        <>
          <section aria-label="Selected month" className={ui.tiles}>
            <Stat
              icon={ArrowUpFromLine}
              label="Income recorded"
              value={formatMoney(totals.income)}
            />
            <Stat
              icon={ArrowDownToLine}
              label="Expenses recorded"
              value={formatMoney(totals.expenses)}
            />
            <Stat
              icon={TrendingUp}
              label="Income after expenses"
              value={formatMoney(totals.income - totals.expenses)}
            />
          </section>
          <BalanceExplainer />
        </>
      )}
      <Commitments open={quickAdd?.commitments === true} />
      {phone ? null : (
        <div className={ui.twoColumn}>
          <section className={ui.card}>
            <div>
              <h2 style={{ fontSize: '1.2rem' }}>Add Income</h2>
              <div className={ui.caption}>Log a salary, rental receipt, or other income</div>
            </div>
            <IncomeForm />
          </section>
          <section className={ui.card}>
            <div>
              <h2 style={{ fontSize: '1.2rem' }}>Add Expense</h2>
              <div className={ui.caption}>Record purchases, annual costs, or EMI payments</div>
            </div>
            <ExpenseForm />
          </section>
        </div>
      )}
      {phone ? (
        <div className={ui.segmented} role="group" aria-label="History">
          {(['income', 'expense'] as const).map((key) => (
            <button
              aria-pressed={history === key}
              className={history === key ? ui.segmentActive : ui.segment}
              key={key}
              onClick={() => setHistory(key)}
              type="button"
            >
              {key === 'income' ? 'Income' : 'Expenses'}
            </button>
          ))}
        </div>
      ) : null}
      <div className={ui.twoColumn}>
        {!phone || history === 'income' ? (
          <HistoryTable
            columns={INCOME_COLUMNS}
            describe={(row) => row.source}
            details={noteDetails}
            emptyText="No income this month."
            onDelete={(row) => commit([{ type: 'delete', collection: 'income', id: row.id }])}
            onEdit={setEditingIncome}
            rows={newest(data.income)}
            openId={quickAdd?.found?.kind === 'income' ? quickAdd.found.id : null}
            title="Income History"
            action={
              phone ? (
                <button className={ui.button} onClick={() => setAdding('income')} type="button">
                  <Plus size={16} /> Add income
                </button>
              ) : undefined
            }
            total={formatMoney(totals.income)}
          />
        ) : null}
        {!phone || history === 'expense' ? (
          <HistoryTable
            columns={expenseColumns}
            describe={(row) => row.subcategory || row.category}
            details={(row) => [
              ...(row.member ? ([['Family member', row.member]] as [string, string][]) : []),
              ...noteDetails(row),
            ]}
            emptyText="No expenses this month."
            onDelete={(row) => commit([{ type: 'delete', collection: 'expenses', id: row.id }])}
            onEdit={setEditingExpense}
            rows={newest(data.expenses)}
            openId={quickAdd?.found?.kind === 'expense' ? quickAdd.found.id : null}
            title="Expense History"
            action={
              phone ? (
                <button className={ui.button} onClick={() => setAdding('expense')} type="button">
                  <Plus size={16} /> Add expense
                </button>
              ) : undefined
            }
            total={formatMoney(totals.expenses)}
          />
        ) : null}
      </div>
      <MonthlyBalances month={month} />
      <MonthReview
        month={month}
        onReviewed={nextReview}
        onToggle={setReviewOpen}
        open={reviewOpen}
      />
      {adding === 'income' ? (
        <Modal fullScreenOnPhone onClose={() => setAdding(null)} title="Add Income">
          <IncomeForm onDone={() => setAdding(null)} />
        </Modal>
      ) : null}
      {adding === 'expense' ? (
        <Modal fullScreenOnPhone onClose={() => setAdding(null)} title="Add Expense">
          <ExpenseForm onDone={() => setAdding(null)} />
        </Modal>
      ) : null}
      {editingIncome ? (
        <Modal fullScreenOnPhone onClose={() => setEditingIncome(null)} title="Edit income">
          <IncomeForm initial={editingIncome} onDone={() => setEditingIncome(null)} />
        </Modal>
      ) : null}
      {editingExpense ? (
        <Modal fullScreenOnPhone onClose={() => setEditingExpense(null)} title="Edit expense">
          <ExpenseForm initial={editingExpense} onDone={() => setEditingExpense(null)} />
        </Modal>
      ) : null}
    </div>
  );
}
