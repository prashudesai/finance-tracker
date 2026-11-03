import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useRef, useState } from 'react';
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
import {
  firstEmiDue,
  paidBeforeTracking,
  type PaidBeforeTracking,
} from '../../domain/paidBeforeTracking';
import { loanPayments } from '../../domain/recurring';
import type { Loan } from '../../schema/records';
import { useSettings, useTracker } from '../../store/tracker';
import { Field } from '../../ui/Field';
import { formatMoney, formatShortMonthYear, localDate } from '../../ui/format';
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

  // Repayments since the first EMI fill in from the terms, until someone types their
  // bank's figures. Opening a saved loan keeps what it has until a term changes.
  const emi = watch('openingEmi');
  const dueDay = watch('emiDueDay');
  const termsKey = (values: unknown[]) => JSON.stringify(values);
  const savedTerms = useRef(
    initial
      ? termsKey([
          initial.principal,
          initial.openingRate,
          initial.openingEmi,
          initial.emiDueDay,
          initial.date,
          initial.firstEmiDate ?? '',
          initial.dailyInterestBasis ?? false,
        ])
      : '',
  );
  const paidEdited = useRef(false);
  const paidFilled = useRef(false);
  const [working, setWorking] = useState<(PaidBeforeTracking & { borrowed: number }) | null>(null);
  useEffect(() => {
    const terms = termsKey([principal, rate, emi, dueDay, startDate, firstEmiDate, daily]);
    if (paidEdited.current || terms === savedTerms.current) return;
    savedTerms.current = terms;
    const day = Number(dueDay);
    const paid =
      isValidDate(startDate) && (!firstEmiDate || isValidDate(firstEmiDate))
        ? paidBeforeTracking(
            {
              id: initial?.id ?? 'draft',
              type: 'draft',
              member: '',
              date: startDate,
              principal: Number(principal) || 0,
              openingRate: Number(rate) || 0,
              openingEmi: Number(emi) || 0,
              ...(validDueDay(day) ? { emiDueDay: day } : {}),
              ...(firstEmiDate ? { firstEmiDate } : {}),
              dailyInterestBasis: daily,
              changes: initial?.changes ?? [],
            },
            expenses,
            localDate(),
          )
        : null;
    // Nothing due before tracking leaves figures entered earlier alone, unless this
    // form filled them.
    if (!paid || 'error' in paid || (paid.count === 0 && !paidFilled.current)) {
      setWorking(null);
      return;
    }
    paidFilled.current = paid.count > 0;
    setWorking({ ...paid, borrowed: Number(principal) || 0 });
    setValue('principalPaidBeforeTracking', paid.principal > 0 ? paid.principal : undefined);
    setValue('interestPaidBeforeTracking', paid.interest > 0 ? paid.interest : undefined);
  }, [daily, dueDay, emi, expenses, firstEmiDate, initial, principal, rate, setValue, startDate]);

  // Only a loan with an EMI already due can have been repaid before tracking, unless
  // a saved loan already holds figures.
  const validDueDay = (value: unknown) =>
    Number.isInteger(value) && Number(value) >= 1 && Number(value) <= 31;
  const hasEmiDue =
    isValidDate(startDate) &&
    (!firstEmiDate || isValidDate(firstEmiDate)) &&
    firstEmiDue({
      date: startDate,
      ...(firstEmiDate ? { firstEmiDate } : {}),
      ...(validDueDay(dueDay) ? { emiDueDay: Number(dueDay) } : {}),
    }) <= localDate();
  const showPaid =
    hasEmiDue ||
    (initial?.principalPaidBeforeTracking ?? 0) > 0 ||
    (initial?.interestPaidBeforeTracking ?? 0) > 0;

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
    if (!showPaid) {
      delete values.principalPaidBeforeTracking;
      delete values.interestPaidBeforeTracking;
    }
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

  const stopPaidEstimate = () => {
    paidEdited.current = true;
    setWorking(null);
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
      {showPaid ? (
        <>
          {number(
            'Principal paid before tracking (₹, automatic · editable)',
            'principalPaidBeforeTracking',
            undefined,
            stopPaidEstimate,
          )}
          {number(
            'Interest paid before tracking (₹, automatic · editable)',
            'interestPaidBeforeTracking',
            undefined,
            stopPaidEstimate,
          )}
        </>
      ) : null}
      {showPaid && working && working.count > 0 ? (
        <div className={ui.formWide}>
          <dl className={ui.detailList}>
            <div>
              <dt>EMIs due so far</dt>
              <dd>
                {working.count} · {formatShortMonthYear((working.from ?? '').slice(0, 7))}
                {working.count > 1
                  ? ` to ${formatShortMonthYear((working.to ?? '').slice(0, 7))}`
                  : ''}
              </dd>
            </div>
            <div>
              <dt>Paid in EMIs</dt>
              <dd>{formatMoney(working.total)}</dd>
            </div>
            <div>
              <dt>Of which interest</dt>
              <dd>{formatMoney(working.interest)}</dd>
            </div>
            <div>
              <dt>Of which principal</dt>
              <dd>{formatMoney(working.principal)}</dd>
            </div>
            <div>
              <dt>Principal left</dt>
              <dd>
                {formatMoney(working.borrowed)} − {formatMoney(working.principal)} ={' '}
                {formatMoney(working.borrowed - working.principal)}
              </dd>
            </div>
          </dl>
          <p className={ui.caption}>
            Each EMI pays the month’s interest on the balance at that point, and the rest repays
            principal, as if every EMI was paid on time. Enter your bank’s figures if they differ.
          </p>
        </div>
      ) : null}
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
