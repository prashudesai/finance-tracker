import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { EMI_CATEGORY, loanSchema, type Expense, type Loan } from '../../schema/records';
import { isLoanFailure, quotePayment } from '../../domain/loan';
import { loanPayments } from '../../domain/recurring';
import { summarizeLoans, totalOutstanding } from '../../domain/summary';
import { useTracker } from '../../store/tracker';
import { Field } from '../../ui/Field';
import { formatMoney, localDate } from '../../ui/format';
import ui from '../../ui/ui.module.css';

const formSchema = loanSchema.pick({
  type: true,
  member: true,
  date: true,
  principal: true,
  openingRate: true,
  openingEmi: true,
});
type FormValues = z.infer<typeof formSchema>;

export function LoansPage() {
  const data = useTracker((state) => state.data);
  const commit = useTracker((state) => state.commit);
  const report = useTracker((state) => state.report);
  const { register, handleSubmit, reset, formState } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { type: '', member: '', date: localDate() },
  });
  const { errors } = formState;
  const today = localDate();
  const summaries = summarizeLoans(data, today);

  const add = (values: FormValues) => {
    const id = crypto.randomUUID();
    const value: Loan = { ...values, id, changes: [] };
    commit([{ type: 'set', collection: 'loans', id, value }]);
    reset({ type: '', member: values.member, date: today });
  };

  const recordEmi = (loan: Loan) => {
    // The quote caps the final instalment at what is still owed.
    const quote = quotePayment(loan, loanPayments(data.expenses, loan.id), today);
    if (isLoanFailure(quote)) {
      report(quote.error);
      return;
    }
    if (quote.paidOff) return;
    const id = crypto.randomUUID();
    const value: Expense = {
      id,
      date: today,
      category: EMI_CATEGORY,
      subcategory: '',
      isAnnual: false,
      loanId: loan.id,
      repaymentType: 'emi',
      amount: quote.amount,
    };
    commit([{ type: 'set', collection: 'expenses', id, value }]);
  };

  return (
    <div className={ui.page}>
      <h1>Loans</h1>
      <form className={`${ui.card} ${ui.form}`} onSubmit={(event) => void handleSubmit(add)(event)}>
        <Field label="Loan type" error={errors.type?.message}>
          <input {...register('type')} />
        </Field>
        <Field label="Family member" error={errors.member?.message}>
          <input {...register('member')} />
        </Field>
        <Field label="Start date" error={errors.date?.message}>
          <input type="date" {...register('date')} />
        </Field>
        <Field label="Principal" error={errors.principal?.message}>
          <input
            inputMode="decimal"
            type="number"
            {...register('principal', { valueAsNumber: true })}
          />
        </Field>
        <Field label="Interest rate %" error={errors.openingRate?.message}>
          <input
            inputMode="decimal"
            step="0.01"
            type="number"
            {...register('openingRate', { valueAsNumber: true })}
          />
        </Field>
        <Field label="Monthly EMI" error={errors.openingEmi?.message}>
          <input
            inputMode="decimal"
            type="number"
            {...register('openingEmi', { valueAsNumber: true })}
          />
        </Field>
        <button className={ui.button} type="submit">
          Add loan
        </button>
      </form>
      <section className={ui.card}>
        <h2>Outstanding {formatMoney(totalOutstanding(summaries))}</h2>
        {summaries.length === 0 ? (
          <p className={ui.empty}>No loans recorded yet.</p>
        ) : (
          <ul className={ui.list}>
            {summaries.map(({ id, type, member, ledger, error }) => (
              <li className={ui.row} key={id}>
                <div className={ui.rowMain}>
                  <div>{type}</div>
                  <div className={ui.rowDetail}>
                    {member}
                    {ledger
                      ? ` · ${ledger.rate}% · EMI ${formatMoney(ledger.emi)} · Interest paid ${formatMoney(ledger.interestPaid)}`
                      : ''}
                  </div>
                  {error ? <div className={ui.fieldError}>{error}</div> : null}
                </div>
                {ledger ? <span className={ui.amount}>{formatMoney(ledger.remaining)}</span> : null}
                {ledger && ledger.remaining > 0 ? (
                  <button
                    aria-label={`Record EMI for ${type}`}
                    className={ui.quiet}
                    onClick={() => {
                      const loan = data.loans.find((row) => row.id === id);
                      if (loan) recordEmi(loan);
                    }}
                    type="button"
                  >
                    Record EMI
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
