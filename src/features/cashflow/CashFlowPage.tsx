import { Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router';
import {
  investedFromIncome,
  isAnyHouseExpense,
  isMonthEnd,
  monthsToReview,
  repaymentsByMonth,
} from '../../domain/analytics';
import { previousMonth } from '../../domain/calendar';
import { monthTotals } from '../../domain/cashflow';
import type { Expense, Income } from '../../schema/records';
import { useSpendingView, useTracker, useView } from '../../store/tracker';
import { formatDay, formatMoney, formatMonth, localDate } from '../../ui/format';
import { CategoryLabel } from '../../ui/CategoryLabel';
import { Modal } from '../../ui/Modal';
import { PageHeader } from '../../ui/PageHeader';
import { scrollToSection } from '../../ui/scroll';
import { useIsPhone } from '../../ui/useIsPhone';
import ui from '../../ui/ui.module.css';
import { Commitments } from './Commitments';
import { MonthFlow } from './MonthFlow';
import { MoneyFlowChart } from './MoneyFlowChart';
import { moneyFlow } from '../../domain/moneyFlow';
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
        Income recorded this month, less expenses recorded this month, loan EMIs and part payments,
        its unrecorded house expense once the closing balance is in, and what was invested from the
        bank. Loan EMIs are shown apart from spending, as they pay off debt; EMIs for something
        bought on EMI, marked as a lifestyle EMI on the loan, count as spending. PF and NPS come out
        of salary before it's paid, so they aren't taken off. Opening bank balances aren't included.
        Family members' personal income follows the selected profile, and household expenses stay
        shared.
      </p>
    </details>
  );
}

/** The same explanation, shown when the chart's Balance band is tapped. */
function BalanceNote() {
  return (
    <p className={ui.caption} style={{ margin: 0 }}>
      Income recorded this month, less spending, loan EMIs and part payments, its unrecorded house
      expense once the closing balance is in, and what was invested from the bank. PF and NPS come
      out of salary before it's paid, so they aren't taken off. Opening bank balances aren't
      included.
    </p>
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
      /** From the dashboard's monthly figures: this month's income or expenses. */
      show?: 'income' | 'expense';
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
    if (quickAdd?.show) {
      setHistory(quickAdd.show);
      scrollToSection('history');
    }
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
  // Recorded entries, and spending with the month's unrecorded house expense, which is worked
  // out from the bank balances once the month is closed, whether or not it was reviewed.
  const spendingView = useSpendingView();
  const recorded = monthTotals({
    ...data,
    expenses: data.expenses.filter((row) => !isAnyHouseExpense(row)),
  }).get(month) ?? { income: 0, expenses: 0 };
  const spent = monthTotals(spendingView).get(month)?.expenses ?? recorded.expenses;
  const unrecorded = Math.max(0, spent - recorded.expenses);
  const totals = { income: recorded.income, expenses: spent };
  // Loan EMIs and part payments leave the bank but aren't spending, so they show on their own.
  const repaid = repaymentsByMonth(data).get(month) ?? 0;
  const recordedSpending = recorded.expenses - repaid;
  // Paid into investments from the bank this month; PF and NPS come out of salary first.
  const invested = investedFromIncome(data).get(month) ?? 0;
  // The expense list's total adds up the entries it shows.
  const listed = monthTotals(data).get(month)?.expenses ?? 0;
  const newest = <Row extends { date: string }>(rows: Row[]) =>
    rows.filter((row) => row.date.startsWith(month)).sort((a, b) => b.date.localeCompare(a.date));
  const months = Array.from({ length: MONTH_CHOICES }).reduce<string[]>(
    (list) => [...list, previousMonth(list.at(-1) ?? current)],
    [current],
  );

  return (
    <div className={ui.page}>
      <PageHeader
        // Phones pick the month from the summary card's title instead.
        action={
          phone ? undefined : (
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
          )
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
      {/* One card: the balance, then where the month's money went. */}
      <MonthFlow
        current={current}
        earliest={months.at(-1) ?? current}
        explainer={<BalanceExplainer />}
        flow={
          <MoneyFlowChart
            balanceNote={<BalanceNote />}
            bare
            flow={moneyFlow(data, month, { unrecorded, invested })}
            month={month}
          />
        }
        income={totals.income}
        invested={invested}
        month={month}
        onMonth={setMonth}
        repaid={repaid}
        spent={recordedSpending}
        stepper={phone}
        unrecorded={unrecorded}
      />
      <Commitments open={quickAdd?.commitments === true} />
      {phone ? null : (
        <div className={ui.twoColumn} id="history">
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
            title="Income history"
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
            title="Expense history"
            action={
              phone ? (
                <button className={ui.button} onClick={() => setAdding('expense')} type="button">
                  <Plus size={16} /> Add expense
                </button>
              ) : undefined
            }
            total={formatMoney(listed)}
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
