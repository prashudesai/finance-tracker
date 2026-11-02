import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { isValidDate } from '../../domain/calendar';
import {
  estimateExtraFirstEmiInterest,
  isLoanFailure,
  rebuildLoan,
  suggestedEmi,
} from '../../domain/loan';
import { optionLists } from '../../domain/options';
import { loanPayments } from '../../domain/recurring';
import type { Loan } from '../../schema/records';
import { useSettings, useTracker } from '../../store/tracker';
import { Field } from '../../ui/Field';
import { localDate } from '../../ui/format';
import { MemberField } from '../../ui/MemberField';
import { Select } from '../../ui/Select';
import ui from '../../ui/ui.module.css';

const amount = z.number({ error: 'Enter a number.' }).nonnegative('Enter zero or more.');
const optional = z.preprocess(
  (value) => (value === '' || Number.isNaN(value) ? undefined : value),
  amount.optional(),
);

const formSchema = z.object({
  type: z.string().trim().min(1, 'This field is required.'),
  member: z.string().max(100),
  principal: amount,
  openingRate: amount,
  tenure: optional,
  openingEmi: amount,
  emiDueDay: z.preprocess(
    (value) => (value === '' || Number.isNaN(value) ? undefined : value),
    z
      .number()
      .int()
      .min(1, 'Enter a day from 1 to 31.')
      .max(31, 'Enter a day from 1 to 31.')
      .optional(),
  ),
  date: z.string().refine(isValidDate, 'Enter a valid date.'),
  firstEmiDate: z.string(),
  firstEmiExtraInterest: optional,
  firstEmiInterestMethod: z.enum(['monthly', 'short-actual365']),
  principalPaidBeforeTracking: optional,
  interestPaidBeforeTracking: optional,
  dailyInterestBasis: z.boolean(),
  notes: z.string().max(500, 'Use 500 characters or fewer.'),
});
type FormInput = z.input<typeof formSchema>;
type FormValues = z.output<typeof formSchema>;

export function LoanForm({ initial, onDone }: { initial?: Loan; onDone: () => void }) {
  const commit = useTracker((state) => state.commit);
  const report = useTracker((state) => state.report);
  const expenses = useTracker((state) => state.data.expenses);
  const settings = useSettings();
  const options = optionLists(settings);
  const { register, handleSubmit, watch, setValue, formState } = useForm<
    FormInput,
    unknown,
    FormValues
  >({
    resolver: zodResolver(formSchema),
    defaultValues: {
      type: initial?.type ?? 'Home Loan',
      member: initial?.member ?? '',
      date: initial?.date ?? localDate(),
      principal: initial?.principal,
      openingRate: initial?.openingRate,
      openingEmi: initial?.openingEmi,
      emiDueDay: initial?.emiDueDay,
      principalPaidBeforeTracking: initial?.principalPaidBeforeTracking,
      interestPaidBeforeTracking: initial?.interestPaidBeforeTracking,
      firstEmiDate: initial?.firstEmiDate ?? '',
      firstEmiExtraInterest: initial?.firstEmiExtraInterest,
      firstEmiInterestMethod: initial?.firstEmiInterestMethod ?? 'monthly',
      dailyInterestBasis: initial?.dailyInterestBasis ?? false,
      notes: initial?.notes ?? '',
    },
  });
  const { errors } = formState;
  const emiEdited = useRef(initial !== undefined);
  const extraEdited = useRef(initial?.firstEmiExtraInterest !== undefined);
  const principal = watch('principal');
  const rate = watch('openingRate');
  const tenure = watch('tenure');
  const startDate = watch('date');
  const firstEmiDate = watch('firstEmiDate');
  const daily = watch('dailyInterestBasis');

  // The EMI fills in from the tenure until someone types their bank's figure.
  useEffect(() => {
    const [amountValue, rateValue, months] = [Number(principal), Number(rate), Number(tenure)];
    if (emiEdited.current || !(amountValue > 0) || !(rateValue >= 0) || !(months > 0)) return;
    setValue('openingEmi', suggestedEmi(amountValue, rateValue, months));
  }, [principal, rate, tenure, setValue]);

  useEffect(() => {
    if (extraEdited.current || !firstEmiDate || !isValidDate(startDate)) return;
    const extra = estimateExtraFirstEmiInterest({
      id: 'draft',
      type: 'draft',
      member: '',
      date: startDate,
      principal: Number(principal) || 0,
      openingRate: Number(rate) || 0,
      openingEmi: 0,
      firstEmiDate,
      dailyInterestBasis: daily,
      changes: [],
    });
    setValue('firstEmiExtraInterest', extra > 0 ? extra : undefined);
  }, [daily, firstEmiDate, principal, rate, setValue, startDate]);

  const save = (form: FormValues) => {
    const { firstEmiDate: first, notes, ...values } = form;
    delete values.tenure;
    const id = initial?.id ?? crypto.randomUUID();
    const value: Loan = {
      ...values,
      id,
      changes: initial?.changes ?? [],
      ...(first ? { firstEmiDate: first } : {}),
      ...(notes ? { notes } : {}),
    };
    const check = rebuildLoan(value, loanPayments(expenses, id), { asOf: localDate() });
    if (isLoanFailure(check)) {
      report(check.error);
      return;
    }
    commit([{ type: 'set', collection: 'loans', id, value }]);
    onDone();
  };

  const number = (label: string, field: keyof FormInput, error?: string, onEdit?: () => void) => {
    const registered = register(field, { valueAsNumber: true });
    return (
      <Field error={error} label={label}>
        <input
          inputMode="decimal"
          step="0.01"
          type="number"
          {...registered}
          onChange={(event) => {
            onEdit?.();
            void registered.onChange(event);
          }}
        />
      </Field>
    );
  };

  return (
    <form className={ui.form} onSubmit={(event) => void handleSubmit(save)(event)}>
      <Field label="Debt Type" error={errors.type?.message}>
        <Select addTo="debtTypes" options={options.debtTypes} {...register('type')} />
      </Field>
      <MemberField
        label="Family Member (Optional)"
        placeholder="-- Optional --"
        {...register('member')}
      />
      {number('Principal Amount (₹)', 'principal', errors.principal?.message)}
      {number('Interest Rate (% p.a.)', 'openingRate', errors.openingRate?.message)}
      {number('Tenure (Months)', 'tenure', errors.tenure?.message)}
      {number('EMI (₹)', 'openingEmi', errors.openingEmi?.message, () => {
        emiEdited.current = true;
      })}
      {number('Monthly EMI Due Date (optional)', 'emiDueDay', errors.emiDueDay?.message)}
      <Field label="Start Date" error={errors.date?.message}>
        <input type="date" {...register('date')} />
      </Field>
      <Field label="First EMI date (optional)">
        <input type="date" {...register('firstEmiDate')} />
      </Field>
      {number(
        'Extra days’ interest with first EMI (₹, automatic · editable)',
        'firstEmiExtraInterest',
        errors.firstEmiExtraInterest?.message,
        () => {
          extraEdited.current = true;
        },
      )}
      <Field label="First EMI interest">
        <select {...register('firstEmiInterestMethod')}>
          <option value="monthly">Standard monthly</option>
          <option value="short-actual365">Short first period, actual days</option>
        </select>
      </Field>
      {number('Principal paid before tracking (₹)', 'principalPaidBeforeTracking')}
      {number('Interest paid before tracking (₹)', 'interestPaidBeforeTracking')}
      <Field label="Notes (Optional)" error={errors.notes?.message}>
        <input {...register('notes')} />
      </Field>
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
