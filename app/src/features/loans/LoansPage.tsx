import { zodResolver } from '@hookform/resolvers/zod';
import { CalendarClock, CircleCheck, Clock, Landmark, Plus } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { EMI_CATEGORY, loanSchema, type Expense, type Loan } from '../../schema/records';
import { isLoanFailure, quotePayment } from '../../domain/loan';
import { loanPayments } from '../../domain/recurring';
import {
  paidShare,
  remainingEmis,
  summarizeLoans,
  totalMonthlyEmi,
  totalOutstanding,
} from '../../domain/summary';
import { useTracker } from '../../store/tracker';
import { Field } from '../../ui/Field';
import { formatMoney, localDate } from '../../ui/format';
import { Modal } from '../../ui/Modal';
import { PageHeader } from '../../ui/PageHeader';
import { Stat } from '../../ui/Stat';
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

function LoanForm({ onDone }: { onDone: () => void }) {
  const commit = useTracker((state) => state.commit);
  const { register, handleSubmit, formState } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { type: '', member: '', date: localDate() },
  });
  const { errors } = formState;

  const add = (values: FormValues) => {
    const id = crypto.randomUUID();
    const value: Loan = { ...values, id, changes: [] };
    commit([{ type: 'set', collection: 'loans', id, value }]);
    onDone();
  };

  return (
    <form className={ui.form} onSubmit={(event) => void handleSubmit(add)(event)}>
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
      <div className={ui.formActions}>
        <button className={ui.button} type="submit">
          Save loan
        </button>
      </div>
    </form>
  );
}

export function LoansPage() {
  const data = useTracker((state) => state.data);
  const commit = useTracker((state) => state.commit);
  const report = useTracker((state) => state.report);
  const [adding, setAdding] = useState(false);
  const today = localDate();
  const summaries = summarizeLoans(data, today);

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
      <PageHeader
        action={
          <button className={ui.button} onClick={() => setAdding(true)} type="button">
            <Plus size={18} /> Add loan
          </button>
        }
        eyebrow="Borrowing"
        subtitle="See what remains and how repayment is going."
        title="Loans"
      />
      <div className={ui.tiles}>
        <Stat
          icon={Landmark}
          label="Outstanding"
          value={formatMoney(totalOutstanding(summaries))}
        />
        <Stat
          icon={CalendarClock}
          label="Monthly EMIs"
          value={formatMoney(totalMonthlyEmi(summaries))}
        />
      </div>
      <section className={ui.card}>
        <h2>Your loans</h2>
        {summaries.length === 0 ? (
          <p className={ui.empty}>No loans recorded yet.</p>
        ) : (
          <ul className={ui.list}>
            {summaries.map(({ id, type, member, ledger, error }) => {
              const paid = ledger ? paidShare(ledger) : 0;
              const active = (ledger?.remaining ?? 0) > 0;
              return (
                <li className={ui.loan} key={id}>
                  <div className={ui.loanTop}>
                    <div className={ui.rowMain}>
                      <div className={ui.rowTitle}>{type}</div>
                      <div className={ui.rowDetail}>{member}</div>
                    </div>
                    {ledger ? (
                      active ? (
                        <span className={ui.badge}>
                          <Clock size={12} /> Active
                        </span>
                      ) : (
                        <span className={ui.badgeDone}>
                          <CircleCheck size={12} /> Paid off
                        </span>
                      )
                    ) : null}
                  </div>
                  {error ? <div className={ui.fieldError}>{error}</div> : null}
                  {ledger ? (
                    <>
                      <dl className={ui.loanFacts}>
                        <div>
                          <dt>Remaining</dt>
                          <dd>{formatMoney(ledger.remaining)}</dd>
                        </div>
                        <div>
                          <dt>Rate</dt>
                          <dd>{ledger.rate}%</dd>
                        </div>
                        <div>
                          <dt>EMI</dt>
                          <dd>{formatMoney(ledger.emi)}</dd>
                        </div>
                        <div>
                          <dt>EMIs left</dt>
                          <dd>{remainingEmis(ledger) ?? '—'}</dd>
                        </div>
                      </dl>
                      <div className={ui.meter} style={{ height: 6 }}>
                        <span className={ui.meterFill} style={{ width: `${paid * 100}%` }} />
                      </div>
                      <div className={ui.meterLegend}>
                        <span>{Math.round(paid * 100)}% repaid</span>
                        <span>Interest paid {formatMoney(ledger.interestPaid)}</span>
                      </div>
                    </>
                  ) : null}
                  {active ? (
                    <div className={ui.loanActions}>
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
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>
      {adding ? (
        <Modal onClose={() => setAdding(false)} title="Add loan">
          <LoanForm onDone={() => setAdding(false)} />
        </Modal>
      ) : null}
    </div>
  );
}
