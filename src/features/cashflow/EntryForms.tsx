import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { isLoanFailure, quotePayment, rebuildLoan } from '../../domain/loan';
import { ANNUAL_BY_DEFAULT, EXPENSE_SUBCATEGORIES, optionLists } from '../../domain/options';
import { loanPayments } from '../../domain/recurring';
import {
  EMI_CATEGORY,
  expenseSchema,
  incomeSchema,
  type Expense,
  type Income,
} from '../../schema/records';
import { useSettings, useTracker } from '../../store/tracker';
import { Field } from '../../ui/Field';
import { formatMoney, formatMonth, localDate } from '../../ui/format';
import { MemberField, useDefaultMember } from '../../ui/MemberField';
import { Select } from '../../ui/Select';
import ui from '../../ui/ui.module.css';

/** A schedule accounts for its records by month, so one can't be moved out of it. */
function leavesSchedule(row: { recurringMonth?: string | undefined } | undefined, date: string) {
  const month = row?.recurringMonth;
  return month && !date.startsWith(month)
    ? `This came from a recurring schedule, so it stays in ${formatMonth(month)}.`
    : null;
}

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
  const defaultMember = useDefaultMember();
  const { register, handleSubmit, reset, setError, formState } = useForm<IncomeValues>({
    resolver: zodResolver(incomeForm),
    defaultValues: initial ?? {
      date: localDate(),
      member: defaultMember || 'Household',
      source: 'Salary',
      notes: '',
    },
  });
  const { errors } = formState;

  const save = (values: IncomeValues) => {
    const moved = leavesSchedule(initial, values.date);
    if (moved) {
      setError('date', { message: moved });
      return;
    }
    const id = initial?.id ?? crypto.randomUUID();
    commit([{ type: 'set', collection: 'income', id, value: { ...initial, ...values, id } }]);
    reset({ date: values.date, member: values.member, source: values.source, notes: '' });
    onDone?.();
  };

  return (
    <form className={ui.form} onSubmit={(event) => void handleSubmit(save)(event)}>
      <MemberField error={errors.member?.message} {...register('member')} />
      <Field label="Source" error={errors.source?.message}>
        <Select addTo="incomeSources" options={options.incomeSources} {...register('source')} />
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
      <Field label="Notes (Optional)" error={errors.notes?.message}>
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
    loanId: z.string(),
    repaymentType: z.enum(['emi', 'part-payment']),
    partPaymentAction: z.enum(['keep', 'reduce']),
  });
type ExpenseValues = z.infer<typeof expenseForm>;

export function ExpenseForm({ initial, onDone }: { initial?: Expense; onDone?: () => void }) {
  const commit = useTracker((state) => state.commit);
  const expenses = useTracker((state) => state.data.expenses);
  const loans = useTracker((state) => state.data.loans);
  const settings = useSettings();
  const options = optionLists(settings);
  const [error, setError] = useState('');
  const form = useForm<ExpenseValues>({
    resolver: zodResolver(expenseForm),
    defaultValues: {
      date: initial?.date ?? localDate(),
      category: initial?.category ?? 'Healthcare',
      subcategory: initial?.subcategory ?? '',
      member: initial?.member ?? '',
      annual: initial?.isAnnual ? 'yes' : 'no',
      loanId: initial?.loanId ?? '',
      repaymentType: initial?.repaymentType ?? 'emi',
      partPaymentAction: initial?.partPaymentAction ?? 'keep',
      notes: initial?.notes ?? '',
      ...(initial ? { amount: initial.amount } : {}),
    },
  });
  const { register, handleSubmit, reset, watch, setValue, formState } = form;
  const { errors } = formState;
  const category = watch('category');
  const loanId = watch('loanId');
  const date = watch('date');
  const repaymentType = watch('repaymentType');
  const partPaymentAction = watch('partPaymentAction');
  const amount = watch('amount');
  const isEmi = category === EMI_CATEGORY;
  const subcategories = EXPENSE_SUBCATEGORIES[category];
  const shownCategory = useRef(category);

  // Follows the older form: these categories default to annual, and an EMI suggests its amount.
  useEffect(() => {
    if (shownCategory.current === category) return;
    shownCategory.current = category;
    setValue('annual', ANNUAL_BY_DEFAULT.includes(category) ? 'yes' : 'no');
    setValue('subcategory', '');
  }, [category, setValue]);

  useEffect(() => {
    const loan = loans.find((row) => row.id === loanId);
    if (initial || !isEmi || !loan || repaymentType !== 'emi' || !date) return;
    const quote = quotePayment(loan, loanPayments(expenses, loan.id), date);
    if (!isLoanFailure(quote) && !quote.paidOff) setValue('amount', quote.amount);
  }, [date, expenses, initial, isEmi, loanId, loans, repaymentType, setValue]);

  const partPaymentResult = (() => {
    const loan = loans.find((row) => row.id === loanId);
    if (!isEmi || !loan || repaymentType !== 'part-payment' || !(amount > 0) || !date) return '';
    const id = initial?.id ?? 'preview';
    const preview = {
      id,
      date,
      amount,
      category: EMI_CATEGORY,
      loanId,
      repaymentType,
      partPaymentAction,
    };
    const others = loanPayments(expenses, loan.id).filter((row) => row.id !== id);
    const result = rebuildLoan(loan, [...others, preview], { asOf: date });
    if (isLoanFailure(result)) return result.error;
    return `${partPaymentAction === 'reduce' ? 'New EMI' : 'EMI stays'} ${formatMoney(result.emi)} · Outstanding after this payment ${formatMoney(result.remaining)}`;
  })();

  const save = ({
    annual,
    member,
    loanId: loan,
    repaymentType: kind,
    partPaymentAction: action,
    ...values
  }: ExpenseValues) => {
    setError('');
    const moved = leavesSchedule(initial, values.date);
    if (moved) {
      form.setError('date', { message: moved });
      return;
    }
    const id = initial?.id ?? crypto.randomUUID();
    const value: Expense = {
      ...initial,
      ...values,
      id,
      isAnnual: annual === 'yes',
      ...(member ? { member } : {}),
      ...(isEmi ? { loanId: loan, repaymentType: kind, isAnnual: false } : {}),
    };
    // `initial` must not bring back what was just cleared.
    if (!member) delete value.member;
    if (isEmi && kind === 'part-payment') value.partPaymentAction = action;
    else delete value.partPaymentAction;
    if (!isEmi) {
      delete value.loanId;
      delete value.repaymentType;
      delete value.interestOverride;
      delete value.interestPaid;
    }
    if (isEmi) {
      const target = loans.find((row) => row.id === loan);
      if (!target) {
        setError('Select the loan this payment is for.');
        return;
      }
      const others = loanPayments(expenses, loan).filter((row) => row.id !== id);
      const check = rebuildLoan(target, [...others, value], { asOf: localDate() });
      if (isLoanFailure(check)) {
        setError(check.error);
        return;
      }
    }
    commit([{ type: 'set', collection: 'expenses', id, value }]);
    reset({
      date: values.date,
      category: values.category,
      subcategory: '',
      member: '',
      annual: 'no',
      loanId: '',
      repaymentType: 'emi',
      partPaymentAction: 'keep',
      notes: '',
    });
    onDone?.();
  };

  return (
    <form className={ui.form} onSubmit={(event) => void handleSubmit(save)(event)}>
      <MemberField
        label="Family Member (Optional)"
        placeholder="-- Household / unspecified --"
        {...register('member')}
      />
      <Field label="Category" error={errors.category?.message}>
        <Select
          addTo="expenseCategories"
          options={options.expenseCategories}
          {...register('category')}
        />
      </Field>
      {subcategories ? (
        <Field label="Expense type">
          <Select
            options={subcategories}
            placeholder="-- Select type --"
            {...register('subcategory')}
          />
        </Field>
      ) : null}
      {isEmi ? (
        <>
          <Field label="Select Loan/Debt">
            <select {...register('loanId')}>
              <option value="">-- Select Debt --</option>
              {loans.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.member ? `${row.type} · ${row.member}` : row.type}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Payment type">
            <select {...register('repaymentType')}>
              <option value="emi">Monthly EMI</option>
              <option value="part-payment">Part Payment</option>
            </select>
          </Field>
          {repaymentType === 'part-payment' ? (
            <Field label="After this payment">
              <select {...register('partPaymentAction')}>
                <option value="keep">Keep EMI same, shorten tenure</option>
                <option value="reduce">Reduce EMI, keep tenure</option>
              </select>
            </Field>
          ) : null}
        </>
      ) : null}
      <Field label="Amount (₹)" error={errors.amount?.message}>
        <input
          inputMode="decimal"
          placeholder="5000"
          step="0.01"
          type="number"
          {...register('amount', { valueAsNumber: true })}
        />
      </Field>
      {partPaymentResult ? <p className={ui.caption}>{partPaymentResult}</p> : null}
      {isEmi ? null : (
        <Field label="Is Annual Expense?">
          <select {...register('annual')}>
            <option value="no">No</option>
            <option value="yes">Yes</option>
          </select>
        </Field>
      )}
      <Field label="Date" error={errors.date?.message}>
        <input type="date" {...register('date')} />
      </Field>
      <Field label="Notes (Optional)" error={errors.notes?.message}>
        <input placeholder="e.g., Medical checkup" {...register('notes')} />
      </Field>
      {error ? (
        <p className={ui.fieldError} role="alert" style={{ gridColumn: '1 / -1', margin: 0 }}>
          {error}
        </p>
      ) : null}
      <div className={ui.formActions}>
        <button className={`${ui.button} ${ui.expense}`} type="submit">
          {initial ? 'Save expense' : 'Add expense'}
        </button>
      </div>
    </form>
  );
}
