import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { isValidDate } from '../../domain/calendar';
import { isLoanFailure, rebuildLoan } from '../../domain/loan';
import { optionLists } from '../../domain/options';
import { loanPayments } from '../../domain/recurring';
import type { Loan } from '../../schema/records';
import { useSettings, useTracker } from '../../store/tracker';
import { Field } from '../../ui/Field';
import { localDate } from '../../ui/format';
import { Select } from '../../ui/Select';
import ui from '../../ui/ui.module.css';

const amount = z.number({ error: 'Enter a number.' }).nonnegative('Enter zero or more.');
const optional = z.preprocess(
  (value) => (value === '' || Number.isNaN(value) ? undefined : value),
  amount.optional(),
);

const formSchema = z.object({
  type: z.string().trim().min(1, 'This field is required.'),
  member: z.string().trim().min(1, 'This field is required.').max(100),
  date: z.string().refine(isValidDate, 'Enter a valid date.'),
  principal: amount,
  openingRate: amount,
  openingEmi: amount,
  principalPaidBeforeTracking: optional,
  interestPaidBeforeTracking: optional,
  firstEmiDate: z.string(),
  firstEmiExtraInterest: optional,
  firstEmiInterestMethod: z.enum(['monthly', 'short-actual365']),
  dailyInterestBasis: z.boolean(),
});
type FormInput = z.input<typeof formSchema>;
type FormValues = z.output<typeof formSchema>;

export function LoanForm({ initial, onDone }: { initial?: Loan; onDone: () => void }) {
  const commit = useTracker((state) => state.commit);
  const report = useTracker((state) => state.report);
  const expenses = useTracker((state) => state.data.expenses);
  const settings = useSettings();
  const options = optionLists(settings);
  const { register, handleSubmit, formState } = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      type: initial?.type ?? 'Home Loan',
      member: initial?.member ?? '',
      date: initial?.date ?? localDate(),
      principal: initial?.principal,
      openingRate: initial?.openingRate,
      openingEmi: initial?.openingEmi,
      principalPaidBeforeTracking: initial?.principalPaidBeforeTracking,
      interestPaidBeforeTracking: initial?.interestPaidBeforeTracking,
      firstEmiDate: initial?.firstEmiDate ?? '',
      firstEmiExtraInterest: initial?.firstEmiExtraInterest,
      firstEmiInterestMethod: initial?.firstEmiInterestMethod ?? 'monthly',
      dailyInterestBasis: initial?.dailyInterestBasis ?? false,
    },
  });
  const { errors } = formState;

  const save = ({ firstEmiDate, ...values }: FormValues) => {
    const id = initial?.id ?? crypto.randomUUID();
    const value: Loan = {
      ...values,
      id,
      changes: initial?.changes ?? [],
      ...(firstEmiDate ? { firstEmiDate } : {}),
    };
    const check = rebuildLoan(value, loanPayments(expenses, id), { asOf: localDate() });
    if (isLoanFailure(check)) {
      report(check.error);
      return;
    }
    commit([{ type: 'set', collection: 'loans', id, value }]);
    onDone();
  };

  const number = (label: string, field: keyof FormInput, error?: string) => (
    <Field error={error} label={label}>
      <input
        inputMode="decimal"
        step="0.01"
        type="number"
        {...register(field, { valueAsNumber: true })}
      />
    </Field>
  );

  return (
    <form className={ui.form} onSubmit={(event) => void handleSubmit(save)(event)}>
      <Field label="Loan type" error={errors.type?.message}>
        <Select options={options.debtTypes} {...register('type')} />
      </Field>
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
      <Field label="Start date" error={errors.date?.message}>
        <input type="date" {...register('date')} />
      </Field>
      {number('Total borrowed (₹)', 'principal', errors.principal?.message)}
      {number('Interest rate (%)', 'openingRate', errors.openingRate?.message)}
      {number('Monthly EMI (₹)', 'openingEmi', errors.openingEmi?.message)}
      <Field label="First EMI date (optional)">
        <input type="date" {...register('firstEmiDate')} />
      </Field>
      {number('Extra first-EMI interest (₹)', 'firstEmiExtraInterest')}
      <Field label="First EMI interest">
        <select {...register('firstEmiInterestMethod')}>
          <option value="monthly">Standard monthly</option>
          <option value="short-actual365">Short first period, actual days</option>
        </select>
      </Field>
      {number('Principal paid before tracking (₹)', 'principalPaidBeforeTracking')}
      {number('Interest paid before tracking (₹)', 'interestPaidBeforeTracking')}
      <label className={ui.check}>
        <input type="checkbox" {...register('dailyInterestBasis')} /> Interest charged on the daily
        balance
      </label>
      <div className={ui.formActions}>
        <button className={ui.button} type="submit">
          Save loan
        </button>
      </div>
    </form>
  );
}
