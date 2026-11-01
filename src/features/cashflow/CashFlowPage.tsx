import { ArrowDownToLine, ArrowUpFromLine, TrendingUp } from 'lucide-react';
import { Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router';
import { previousMonth } from '../../domain/calendar';
import { monthTotals } from '../../domain/cashflow';
import type { Expense, Income } from '../../schema/records';
import { useTracker, useView } from '../../store/tracker';
import { formatDay, formatMoney, formatMonth, localDate } from '../../ui/format';
import { Modal } from '../../ui/Modal';
import { PageHeader } from '../../ui/PageHeader';
import { Stat } from '../../ui/Stat';
import { useIsPhone } from '../../ui/useIsPhone';
import ui from '../../ui/ui.module.css';
import { Commitments } from './Commitments';
import { ExpenseForm, IncomeForm } from './EntryForms';
import { HistoryTable } from './HistoryTable';
import { MonthlyBalances } from './MonthlyBalances';
import { MonthReview } from './MonthReview';

const MONTH_CHOICES = 24;

export function CashFlowPage() {
  const data = useView();
  const commit = useTracker((state) => state.commit);
  const current = localDate().slice(0, 7);
  const [month, setMonth] = useState(current);
  const [editingIncome, setEditingIncome] = useState<Income | null>(null);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [adding, setAdding] = useState<'income' | 'expense' | null>(null);
  const [history, setHistory] = useState<'income' | 'expense'>('income');
  const phone = useIsPhone();
  const { state: quickAdd } = useLocation() as { state: { add?: 'income' | 'expense' } | null };

  // The dashboard's add menu lands here with the entry to open.
  useEffect(() => {
    if (!quickAdd?.add) return;
    setHistory(quickAdd.add);
    setAdding(quickAdd.add);
  }, [quickAdd]);

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
            {months.map((key) => (
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
      <section aria-label="Selected month" className={ui.tiles}>
        <Stat icon={ArrowUpFromLine} label="Income recorded" value={formatMoney(totals.income)} />
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
      <Commitments />
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
            columns={[
              { header: 'Member', cell: (row) => row.member },
              { header: 'Source', cell: (row) => row.source },
              { header: 'Amount', numeric: true, cell: (row) => formatMoney(row.amount) },
              { header: 'Date', cell: (row) => formatDay(row.date) },
            ]}
            describe={(row) => row.source}
            emptyText="No income this month."
            onDelete={(row) => commit([{ type: 'delete', collection: 'income', id: row.id }])}
            onEdit={setEditingIncome}
            rows={newest(data.income)}
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
            columns={[
              { header: 'Category', cell: (row) => row.category },
              { header: 'Amount', numeric: true, cell: (row) => formatMoney(row.amount) },
              { header: 'Type', cell: (row) => (row.isAnnual ? 'Annual' : 'Monthly') },
              { header: 'Notes', cell: (row) => row.subcategory || row.notes || '—' },
              { header: 'Date', cell: (row) => formatDay(row.date) },
            ]}
            describe={(row) => row.subcategory || row.category}
            emptyText="No expenses this month."
            onDelete={(row) => commit([{ type: 'delete', collection: 'expenses', id: row.id }])}
            onEdit={setEditingExpense}
            rows={newest(data.expenses)}
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
      <MonthReview month={month} />
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
