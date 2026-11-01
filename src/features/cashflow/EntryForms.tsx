import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { optionLists } from '../../domain/options';
import { expenseSchema, incomeSchema, type Expense, type Income } from '../../schema/records';
import { useSettings, useTracker } from '../../store/tracker';
import { Field } from '../../ui/Field';
import { localDate } from '../../ui/format';
import { Select } from '../../ui/Select';
import ui from '../../ui/ui.module.css';

const incomeForm = incomeSchema.pick({
  date: true,
  member: true,
  source: true,
  amount: true,
  notes: true,
});
type IncomeValues = z.infer<typeof incomeForm>;

export function IncomeForm({ initial, onDone }: { initial?: Income; onDone?: () => void }) {
  const commit = useTracker((state) => state.commit);
  const settings = useSettings();
  const options = optionLists(settings);
  const { register, handleSubmit, reset, formState } = useForm<IncomeValues>({
    resolver: zodResolver(incomeForm),
    defaultValues: initial ?? { date: localDate(), member: '', source: 'Salary', notes: '' },
  });
  const { errors } = formState;

  const save = (values: IncomeValues) => {
    const id = initial?.id ?? crypto.randomUUID();
    commit([{ type: 'set', collection: 'income', id, value: { ...initial, ...values, id } }]);
    reset({ date: values.date, member: values.member, source: values.source, notes: '' });
    onDone?.();
  };

  return (
    <form className={ui.form} onSubmit={(event) => void handleSubmit(save)(event)}>
      <Field label="Family member" error={errors.member?.message}>
        {options.familyMembers.length > 0 ? (
          <Select
            options={options.familyMembers}
            placeholder="-- Select family member --"
            {...register('member')}
          />
        ) : (
          <input {...register('member')} />
        )}
      </Field>
      <Field label="Source" error={errors.source?.message}>
        <Select options={options.incomeSources} {...register('source')} />
      </Field>
      <Field label="Amount (₹)" error={errors.amount?.message}>
        <input
          inputMode="decimal"
          placeholder="50000"
          step="0.01"
          type="number"
          {...register('amount', { valueAsNumber: true })}
        />
      </Field>
      <Field label="Date" error={errors.date?.message}>
        <input type="date" {...register('date')} />
      </Field>
      <Field label="Notes (optional)" error={errors.notes?.message}>
        <input placeholder="e.g., performance bonus" {...register('notes')} />
      </Field>
      <div className={ui.formActions}>
        <button className={ui.button} type="submit">
          {initial ? 'Save income' : 'Add income'}
        </button>
      </div>
    </form>
  );
}

const expenseForm = expenseSchema
  .pick({ date: true, category: true, amount: true, notes: true })
  .extend({
    subcategory: z.string().max(100),
    annual: z.enum(['no', 'yes']),
    member: z.string().max(100),
  });
type ExpenseValues = z.infer<typeof expenseForm>;

export function ExpenseForm({ initial, onDone }: { initial?: Expense; onDone?: () => void }) {
  const commit = useTracker((state) => state.commit);
  const settings = useSettings();
  const options = optionLists(settings);
  const { register, handleSubmit, reset, formState } = useForm<ExpenseValues>({
    resolver: zodResolver(expenseForm),
    defaultValues: initial
      ? { ...initial, member: initial.member ?? '', annual: initial.isAnnual ? 'yes' : 'no' }
      : {
          date: localDate(),
          category: 'Groceries',
          subcategory: '',
          member: '',
          annual: 'no',
          notes: '',
        },
  });
  const { errors } = formState;

  const save = ({ annual, member, ...values }: ExpenseValues) => {
    const id = initial?.id ?? crypto.randomUUID();
    const value: Expense = {
      ...initial,
      ...values,
      id,
      isAnnual: annual === 'yes',
      ...(member ? { member } : {}),
    };
    commit([{ type: 'set', collection: 'expenses', id, value }]);
    reset({ ...values, member: '', annual: 'no', subcategory: '', notes: '' });
    onDone?.();
  };

  return (
    <form className={ui.form} onSubmit={(event) => void handleSubmit(save)(event)}>
      <Field label="Family member (optional)">
        <Select
          options={options.familyMembers}
          placeholder="-- Household / unspecified --"
          {...register('member')}
        />
      </Field>
      <Field label="Category" error={errors.category?.message}>
        <Select options={options.expenseCategories} {...register('category')} />
      </Field>
      <Field label="Details (optional)" error={errors.subcategory?.message}>
        <input {...register('subcategory')} />
      </Field>
      <Field label="Amount (₹)" error={errors.amount?.message}>
        <input
          inputMode="decimal"
          placeholder="5000"
          step="0.01"
          type="number"
          {...register('amount', { valueAsNumber: true })}
        />
      </Field>
      <Field label="Is annual expense?">
        <select {...register('annual')}>
          <option value="no">No</option>
          <option value="yes">Yes</option>
        </select>
      </Field>
      <Field label="Date" error={errors.date?.message}>
        <input type="date" {...register('date')} />
      </Field>
      <Field label="Notes (optional)" error={errors.notes?.message}>
        <input placeholder="e.g., Medical checkup" {...register('notes')} />
      </Field>
      <div className={ui.formActions}>
        <button className={`${ui.button} ${ui.expense}`} type="submit">
          {initial ? 'Save expense' : 'Add expense'}
        </button>
      </div>
    </form>
  );
}
