import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowUpRight, CalendarDays, Plus, Receipt, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { expenseSchema, type Expense } from '../../schema/records';
import { useTracker } from '../../store/tracker';
import { Field } from '../../ui/Field';
import { formatDay, formatMoney, localDate } from '../../ui/format';
import { Modal } from '../../ui/Modal';
import { PageHeader } from '../../ui/PageHeader';
import { Stat } from '../../ui/Stat';
import ui from '../../ui/ui.module.css';
import { groupByMonth } from '../records';

const formSchema = expenseSchema.pick({ date: true, category: true, amount: true }).extend({
  subcategory: z.string().max(100),
});
type FormValues = z.infer<typeof formSchema>;

const rowLabel = (row: Expense) => row.subcategory || row.category;

function ExpenseForm({ onDone }: { onDone: () => void }) {
  const commit = useTracker((state) => state.commit);
  const { register, handleSubmit, formState } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { date: localDate(), category: '', subcategory: '' },
  });
  const { errors } = formState;

  const add = (values: FormValues) => {
    const id = crypto.randomUUID();
    const value: Expense = { ...values, id, isAnnual: false };
    commit([{ type: 'set', collection: 'expenses', id, value }]);
    onDone();
  };

  return (
    <form className={ui.form} onSubmit={(event) => void handleSubmit(add)(event)}>
      <Field label="Date" error={errors.date?.message}>
        <input type="date" {...register('date')} />
      </Field>
      <Field label="Category" error={errors.category?.message}>
        <input {...register('category')} />
      </Field>
      <Field label="Details" error={errors.subcategory?.message}>
        <input {...register('subcategory')} />
      </Field>
      <Field label="Amount" error={errors.amount?.message}>
        <input
          inputMode="decimal"
          step="0.01"
          type="number"
          {...register('amount', { valueAsNumber: true })}
        />
      </Field>
      <div className={ui.formActions}>
        <button className={ui.button} type="submit">
          Save expense
        </button>
      </div>
    </form>
  );
}

export function ExpensesPage() {
  const expenses = useTracker((state) => state.data.expenses);
  const commit = useTracker((state) => state.commit);
  const [adding, setAdding] = useState(false);
  const month = localDate().slice(0, 7);
  const thisMonth = expenses.filter((row) => row.date.startsWith(month));
  const total = thisMonth.reduce((sum, row) => sum + row.amount, 0);

  return (
    <div className={ui.page}>
      <PageHeader
        action={
          <button className={ui.button} onClick={() => setAdding(true)} type="button">
            <Plus size={18} /> Add expense
          </button>
        }
        eyebrow="Cash flow"
        subtitle="What your household spends, including EMIs."
        title="Expenses"
      />
      <div className={ui.tiles}>
        <Stat icon={Receipt} label="This month" value={formatMoney(total)} />
        <Stat icon={CalendarDays} label="Entries this month" value={String(thisMonth.length)} />
      </div>
      <section className={ui.card}>
        {expenses.length === 0 ? (
          <p className={ui.empty}>No expenses recorded yet.</p>
        ) : (
          groupByMonth(expenses).map(({ month: key, label, items }) => (
            <div key={key}>
              <h2 className={ui.groupLabel}>{label}</h2>
              <ul className={ui.list}>
                {items.map((row) => (
                  <li className={ui.row} key={row.id}>
                    <span aria-hidden="true" className={ui.rowIconExpense}>
                      <ArrowUpRight size={18} />
                    </span>
                    <div className={ui.rowMain}>
                      <div className={ui.rowTitle}>{rowLabel(row)}</div>
                      <div className={ui.rowDetail}>
                        {formatDay(row.date)} · {row.category}
                      </div>
                    </div>
                    <span className={ui.amount}>{formatMoney(row.amount)}</span>
                    <button
                      aria-label={`Delete ${rowLabel(row)}`}
                      className={ui.iconButton}
                      onClick={() =>
                        commit([{ type: 'delete', collection: 'expenses', id: row.id }])
                      }
                      type="button"
                    >
                      <Trash2 size={16} />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </section>
      {adding ? (
        <Modal onClose={() => setAdding(false)} title="Add expense">
          <ExpenseForm onDone={() => setAdding(false)} />
        </Modal>
      ) : null}
    </div>
  );
}
