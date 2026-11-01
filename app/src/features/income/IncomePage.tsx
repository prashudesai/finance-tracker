import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowDownLeft, CalendarDays, Plus, Trash2, Wallet } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { incomeSchema } from '../../schema/records';
import { useTracker } from '../../store/tracker';
import { Field } from '../../ui/Field';
import { formatDay, formatMoney, localDate } from '../../ui/format';
import { Modal } from '../../ui/Modal';
import { PageHeader } from '../../ui/PageHeader';
import { Stat } from '../../ui/Stat';
import ui from '../../ui/ui.module.css';
import { groupByMonth } from '../records';

const formSchema = incomeSchema.pick({ date: true, member: true, source: true, amount: true });
type FormValues = z.infer<typeof formSchema>;

function IncomeForm({ onDone }: { onDone: () => void }) {
  const commit = useTracker((state) => state.commit);
  const { register, handleSubmit, formState } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { date: localDate(), member: '', source: '' },
  });
  const { errors } = formState;

  const add = (values: FormValues) => {
    const id = crypto.randomUUID();
    commit([{ type: 'set', collection: 'income', id, value: { ...values, id } }]);
    onDone();
  };

  return (
    <form className={ui.form} onSubmit={(event) => void handleSubmit(add)(event)}>
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
      <div className={ui.formActions}>
        <button className={ui.button} type="submit">
          Save income
        </button>
      </div>
    </form>
  );
}

export function IncomePage() {
  const income = useTracker((state) => state.data.income);
  const commit = useTracker((state) => state.commit);
  const [adding, setAdding] = useState(false);
  const month = localDate().slice(0, 7);
  const thisMonth = income.filter((row) => row.date.startsWith(month));
  const total = thisMonth.reduce((sum, row) => sum + row.amount, 0);

  return (
    <div className={ui.page}>
      <PageHeader
        action={
          <button className={ui.button} onClick={() => setAdding(true)} type="button">
            <Plus size={18} /> Add income
          </button>
        }
        eyebrow="Cash flow"
        subtitle="Everything your household earns."
        title="Income"
      />
      <div className={ui.tiles}>
        <Stat icon={Wallet} label="This month" value={formatMoney(total)} />
        <Stat icon={CalendarDays} label="Entries this month" value={String(thisMonth.length)} />
      </div>
      <section className={ui.card}>
        {income.length === 0 ? (
          <p className={ui.empty}>No income recorded yet.</p>
        ) : (
          groupByMonth(income).map(({ month: key, label, items }) => (
            <div key={key}>
              <h2 className={ui.groupLabel}>{label}</h2>
              <ul className={ui.list}>
                {items.map((row) => (
                  <li className={ui.row} key={row.id}>
                    <span aria-hidden="true" className={ui.rowIcon}>
                      <ArrowDownLeft size={18} />
                    </span>
                    <div className={ui.rowMain}>
                      <div className={ui.rowTitle}>{row.source}</div>
                      <div className={ui.rowDetail}>
                        {formatDay(row.date)} · {row.member}
                      </div>
                    </div>
                    <span className={ui.amount}>{formatMoney(row.amount)}</span>
                    <button
                      aria-label={`Delete ${row.source}`}
                      className={ui.iconButton}
                      onClick={() => commit([{ type: 'delete', collection: 'income', id: row.id }])}
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
        <Modal onClose={() => setAdding(false)} title="Add income">
          <IncomeForm onDone={() => setAdding(false)} />
        </Modal>
      ) : null}
    </div>
  );
}
