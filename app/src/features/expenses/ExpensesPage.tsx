import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { expenseSchema, type Expense } from '../../schema/records';
import { useTracker } from '../../store/tracker';
import { Field } from '../../ui/Field';
import { formatMoney, localDate } from '../../ui/format';
import ui from '../../ui/ui.module.css';

const formSchema = expenseSchema.pick({ date: true, category: true, amount: true }).extend({
  subcategory: z.string().max(100),
});
type FormValues = z.infer<typeof formSchema>;

const rowLabel = (row: Expense) => row.subcategory || row.category;

export function ExpensesPage() {
  const expenses = useTracker((state) => state.data.expenses);
  const commit = useTracker((state) => state.commit);
  const { register, handleSubmit, reset, formState } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { date: localDate(), category: '', subcategory: '' },
  });
  const { errors } = formState;

  const add = (values: FormValues) => {
    const id = crypto.randomUUID();
    const value: Expense = { ...values, id, isAnnual: false };
    commit([{ type: 'set', collection: 'expenses', id, value }]);
    reset({ date: values.date, category: values.category, subcategory: '' });
  };

  const rows = [...expenses].sort((a, b) => b.date.localeCompare(a.date));
  return (
    <div className={ui.page}>
      <h1>Expenses</h1>
      <form className={`${ui.card} ${ui.form}`} onSubmit={(event) => void handleSubmit(add)(event)}>
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
        <button className={ui.button} type="submit">
          Add expense
        </button>
      </form>
      <section className={ui.card}>
        {rows.length === 0 ? (
          <p className={ui.empty}>No expenses recorded yet.</p>
        ) : (
          <ul className={ui.list}>
            {rows.map((row) => (
              <li className={ui.row} key={row.id}>
                <div className={ui.rowMain}>
                  <div>{rowLabel(row)}</div>
                  <div className={ui.rowDetail}>
                    {row.date} · {row.category}
                  </div>
                </div>
                <span className={ui.amount}>{formatMoney(row.amount)}</span>
                <button
                  aria-label={`Delete ${rowLabel(row)}`}
                  className={ui.quiet}
                  onClick={() => commit([{ type: 'delete', collection: 'expenses', id: row.id }])}
                  type="button"
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
