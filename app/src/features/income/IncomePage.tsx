import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { incomeSchema } from '../../schema/records';
import { useTracker } from '../../store/tracker';
import { Field } from '../../ui/Field';
import { formatMoney, localDate } from '../../ui/format';
import ui from '../../ui/ui.module.css';

const formSchema = incomeSchema.pick({ date: true, member: true, source: true, amount: true });
type FormValues = z.infer<typeof formSchema>;

export function IncomePage() {
  const income = useTracker((state) => state.data.income);
  const commit = useTracker((state) => state.commit);
  const { register, handleSubmit, reset, formState } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { date: localDate(), member: '', source: '' },
  });
  const { errors } = formState;

  const add = (values: FormValues) => {
    const id = crypto.randomUUID();
    commit([{ type: 'set', collection: 'income', id, value: { ...values, id } }]);
    reset({ date: values.date, member: values.member, source: '' });
  };

  const rows = [...income].sort((a, b) => b.date.localeCompare(a.date));
  return (
    <div className={ui.page}>
      <h1>Income</h1>
      <form className={`${ui.card} ${ui.form}`} onSubmit={(event) => void handleSubmit(add)(event)}>
        <Field label="Date" error={errors.date?.message}>
          <input type="date" {...register('date')} />
        </Field>
        <Field label="Family member" error={errors.member?.message}>
          <input {...register('member')} />
        </Field>
        <Field label="Source" error={errors.source?.message}>
          <input {...register('source')} />
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
          Add income
        </button>
      </form>
      <section className={ui.card}>
        {rows.length === 0 ? (
          <p className={ui.empty}>No income recorded yet.</p>
        ) : (
          <ul className={ui.list}>
            {rows.map((row) => (
              <li className={ui.row} key={row.id}>
                <div className={ui.rowMain}>
                  <div>{row.source}</div>
                  <div className={ui.rowDetail}>
                    {row.date} · {row.member}
                  </div>
                </div>
                <span className={ui.amount}>{formatMoney(row.amount)}</span>
                <button
                  aria-label={`Delete ${row.source}`}
                  className={ui.quiet}
                  onClick={() => commit([{ type: 'delete', collection: 'income', id: row.id }])}
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
